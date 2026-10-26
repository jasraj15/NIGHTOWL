import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './testHelper.js';
import { OtpToken } from '../models/OtpToken.js';
import { hashOtp } from '../services/emailService.js';

describe('Authentication API & OTP Security', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('rejects registration with non-college email domain', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Rahul Sharma',
      email: 'rahul@gmail.com', // Not @sst.scaler.com
      phoneNumber: '9876543210',
      hostel: 'Uniworld 1',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details?.[0]?.message).toMatch(/sst\.scaler\.com/);
  });

  it('rejects registration with invalid Indian phone number', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Rahul Sharma',
      email: 'rahul.s@sst.scaler.com',
      phoneNumber: '12345678', // Invalid phone
      hostel: 'Uniworld 1',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('registers successfully with valid college email and sends OTP', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Rahul Sharma',
      email: 'rahul.s@sst.scaler.com',
      phoneNumber: '9876543210',
      hostel: 'Uniworld 1',
      roomNumber: 'A-302',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe('rahul.s@sst.scaler.com');

    // Token was stored in DB
    const tokenDoc = await OtpToken.findOne({ email: 'rahul.s@sst.scaler.com' });
    expect(tokenDoc).not.toBeNull();
    expect(tokenDoc?.attempts).toBe(0);
  });

  it('verifies valid OTP, sets HttpOnly cookie, and prevents OTP reuse', async () => {
    // Setup registration
    await request(app).post('/api/auth/register').send({
      fullName: 'Rahul Sharma',
      email: 'rahul.s@sst.scaler.com',
      phoneNumber: '9876543210',
      hostel: 'Uniworld 1',
    });

    // Manually set known OTP in DB
    const testOtp = '123456';
    await OtpToken.updateOne(
      { email: 'rahul.s@sst.scaler.com' },
      { otpHash: hashOtp(testOtp) }
    );

    // Verify OTP
    const verifyRes = await request(app).post('/api/auth/verify-otp').send({
      email: 'rahul.s@sst.scaler.com',
      otp: testOtp,
      purpose: 'register',
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.user.isEmailVerified).toBe(true);

    // Check cookie
    const cookies = verifyRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/nightowl_token=/);
    expect(cookies[0]).toMatch(/HttpOnly/);

    // Single use: cannot verify with same OTP again
    const reuseRes = await request(app).post('/api/auth/verify-otp').send({
      email: 'rahul.s@sst.scaler.com',
      otp: testOtp,
      purpose: 'register',
    });
    expect(reuseRes.status).toBe(400);
  });

  it('increments attempts on wrong OTP and rejects after max attempts', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Neha Gupta',
      email: 'neha.g@sst.scaler.com',
      phoneNumber: '9876543211',
      hostel: 'Uniworld 2',
    });

    // Attempt 5 wrong OTPs
    for (let i = 1; i <= 5; i++) {
      const res = await request(app).post('/api/auth/verify-otp').send({
        email: 'neha.g@sst.scaler.com',
        otp: '000000',
        purpose: 'register',
      });
      expect(res.status).toBe(400);
    }

    // Token should now be invalidated / removed
    const tokenDoc = await OtpToken.findOne({ email: 'neha.g@sst.scaler.com' });
    expect(tokenDoc).toBeNull();
  });
});
