import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, teardownTestDB, clearTestDB, createTestUser, api } from './testHelper.js';
import { OtpToken } from '../models/OtpToken.js';
import { User } from '../models/User.js';

const validRegistration = {
  fullName: 'Asha Verma',
  email: 'asha.verma@sst.scaler.com',
  phoneNumber: '9876543210',
  agreedToRules: true,
};

describe('Authentication & onboarding', () => {
  beforeAll(setupTestDB);
  afterAll(teardownTestDB);
  beforeEach(clearTestDB);

  describe('1. Registration validation & college email restriction', () => {
    it('rejects non-@sst.scaler.com emails', async () => {
      const res = await api().post('/api/v1/auth/register').send({ ...validRegistration, email: 'someone@gmail.com' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/sst\.scaler\.com/);
    });

    it('rejects look-alike domains such as sst.scaler.com.evil.com', async () => {
      const res = await api().post('/api/v1/auth/register').send({ ...validRegistration, email: 'x@sst.scaler.com.evil.com' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid Indian phone numbers', async () => {
      const res = await api().post('/api/v1/auth/register').send({ ...validRegistration, phoneNumber: '12345' });
      expect(res.status).toBe(400);
    });

    it('requires agreement to community rules', async () => {
      const res = await api().post('/api/v1/auth/register').send({ ...validRegistration, agreedToRules: false });
      expect(res.status).toBe(400);
    });

    it('accepts a valid registration and issues an OTP without logging the user in', async () => {
      const res = await api().post('/api/v1/auth/register').send(validRegistration);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeUndefined();
      const user = await User.findOne({ email: validRegistration.email });
      expect(user?.isEmailVerified).toBe(false);
      expect(user?.hostelSelected).toBe(false);
    });

    it('refuses to re-register an already verified email', async () => {
      await createTestUser({ email: validRegistration.email });
      const res = await api().post('/api/v1/auth/register').send(validRegistration);
      expect(res.status).toBe(409);
    });
  });

  describe('2. OTP expiry and invalid attempts', () => {
    it('rejects an incorrect code and locks after 5 wrong attempts', async () => {
      const reg = await api().post('/api/v1/auth/register').send(validRegistration);
      const realOtp: string = reg.body.debugOtp;
      expect(realOtp).toMatch(/^\d{6}$/);
      const wrong = realOtp === '000000' ? '111111' : '000000';

      for (let i = 1; i <= 4; i++) {
        const r = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: wrong, purpose: 'register' });
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(/attempt/i);
      }
      const fifth = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: wrong, purpose: 'register' });
      expect(fifth.status).toBe(400);
      expect(fifth.body.error).toMatch(/too many/i);

      // Even the real code no longer works: the token was destroyed.
      const afterLock = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: realOtp, purpose: 'register' });
      expect(afterLock.status).toBe(400);
    });

    it('rejects an expired code', async () => {
      const reg = await api().post('/api/v1/auth/register').send(validRegistration);
      await OtpToken.updateMany({ email: validRegistration.email }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      const r = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: reg.body.debugOtp, purpose: 'register' });
      expect(r.status).toBe(400);
      expect(r.body.error).toMatch(/expired/i);
    });

    it('enforces the resend cooldown', async () => {
      await api().post('/api/v1/auth/register').send(validRegistration);
      const resend = await api().post('/api/v1/auth/resend-otp').send({ email: validRegistration.email, purpose: 'register' });
      expect(resend.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(resend.body)).toMatch(/wait/i);
    });

    it('a correct code is single-use', async () => {
      const reg = await api().post('/api/v1/auth/register').send(validRegistration);
      const ok = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: reg.body.debugOtp, purpose: 'register' });
      expect(ok.status).toBe(200);
      const again = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: reg.body.debugOtp, purpose: 'register' });
      expect(again.status).toBe(400);
    });
  });

  describe('3. Login, session cookie, hostel selection and protected routes', () => {
    it('verifies OTP, sets an HttpOnly cookie and directs new users to hostel selection', async () => {
      const reg = await api().post('/api/v1/auth/register').send(validRegistration);
      const verify = await api().post('/api/v1/auth/verify-otp').send({ email: validRegistration.email, otp: reg.body.debugOtp, purpose: 'register' });
      expect(verify.status).toBe(200);
      expect(verify.body.nextStep).toBe('select-hostel');
      expect(verify.body.token).toBeUndefined(); // token lives only in the cookie

      const cookieHeader = verify.headers['set-cookie'] as unknown as string[];
      expect(cookieHeader[0]).toMatch(/nightowl_token=/);
      expect(cookieHeader[0]).toMatch(/HttpOnly/);

      const me = await api().get('/api/v1/users/me').set('Cookie', cookieHeader);
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe(validRegistration.email);
      expect(me.body.user.hostelSelected).toBe(false);

      // Creating a pool before selecting a hostel is refused.
      const pool = await api().post('/api/v1/pools').set('Cookie', cookieHeader).send({
        title: 'Too early', retailer: 'Zepto', hostel: 'Uniworld 1', deliveryZone: 'Lobby', deliveryConfirmed: true, targetAmount: 200, durationMinutes: 15,
      });
      expect(pool.status).toBe(403);
      expect(pool.body.code).toBe('HOSTEL_NOT_SELECTED');

      const select = await api().post('/api/v1/users/me/hostel').set('Cookie', cookieHeader).send({ hostel: 'Uniworld 2' });
      expect(select.status).toBe(200);
      expect(select.body.user.hostel).toBe('Uniworld 2');
      expect(select.body.user.hostelSelected).toBe(true);
    });

    it('login OTP flow works for an existing account and restores the session', async () => {
      const { user } = await createTestUser();
      const req = await api().post('/api/v1/auth/login-request').send({ email: user.email });
      expect(req.status).toBe(200);
      const verify = await api().post('/api/v1/auth/verify-otp').send({ email: user.email, otp: req.body.debugOtp, purpose: 'login' });
      expect(verify.status).toBe(200);
      expect(verify.body.nextStep).toBe('dashboard');
      const me = await api().get('/api/v1/auth/me').set('Cookie', verify.headers['set-cookie']);
      expect(me.status).toBe(200);
      expect(me.body.user._id).toBe(user._id.toString());
    });

    it('login request for an unknown email returns 404 without creating an account', async () => {
      const res = await api().post('/api/v1/auth/login-request').send({ email: 'ghost@sst.scaler.com' });
      expect(res.status).toBe(404);
      expect(await User.countDocuments()).toBe(0);
    });

    it('logout clears the cookie', async () => {
      const t = await createTestUser();
      const res = await api().post('/api/v1/auth/logout').set('Cookie', t.cookie);
      expect(res.status).toBe(200);
      expect(String(res.headers['set-cookie'])).toMatch(/nightowl_token=;/);
    });
  });

  describe('4. Unauthenticated access rejection', () => {
    it.each([
      ['GET', '/api/v1/users/me'],
      ['GET', '/api/v1/pools'],
      ['POST', '/api/v1/pools'],
      ['GET', '/api/v1/notifications'],
      ['GET', '/api/v1/payments/history'],
      ['GET', '/api/v1/pools/orders/mine'],
    ])('%s %s → 401', async (method, path) => {
      const res = await (api() as any)[method.toLowerCase()](path).send({});
      expect(res.status).toBe(401);
    });

    it('rejects a tampered token', async () => {
      const res = await api().get('/api/v1/users/me').set('Cookie', ['nightowl_token=abc.def.ghi']);
      expect(res.status).toBe(401);
    });

    it('unverified accounts cannot access pools', async () => {
      const t = await createTestUser({ isEmailVerified: false });
      const res = await api().get('/api/v1/pools').set('Cookie', t.cookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('deactivated accounts are rejected', async () => {
      const t = await createTestUser();
      const del = await api().delete('/api/v1/users/me').set('Cookie', t.cookie).send({ confirmEmail: t.user.email });
      expect(del.status).toBe(200);
      const me = await api().get('/api/v1/users/me').set('Cookie', t.cookie);
      expect(me.status).toBe(401);
    });

    it('moderator routes reject students', async () => {
      const t = await createTestUser();
      const res = await api().get('/api/v1/admin/reports').set('Cookie', t.cookie);
      expect(res.status).toBe(403);
      const mod = await createTestUser({ role: 'moderator' });
      const ok = await api().get('/api/v1/admin/reports').set('Cookie', mod.cookie);
      expect(ok.status).toBe(200);
    });
  });

  describe('Preferences', () => {
    it('persists theme and notification preferences', async () => {
      const t = await createTestUser();
      const res = await api()
        .patch('/api/v1/users/me/preferences')
        .set('Cookie', t.cookie)
        .send({ theme: 'light', notifications: { paymentUpdates: false } });
      expect(res.status).toBe(200);
      expect(res.body.user.preferences.theme).toBe('light');
      expect(res.body.user.preferences.notifications.paymentUpdates).toBe(false);
      expect(res.body.user.preferences.notifications.orderUpdates).toBe(true);
    });
  });
});
