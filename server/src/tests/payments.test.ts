import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  api,
  buildOrderedPool,
  createPoolViaApi,
  joinPoolViaApi,
  addItemViaApi,
} from './testHelper.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { PaymentEvent } from '../models/PaymentEvent.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { env, razorpayConfigured } from '../config/env.js';

/* ------------------------------------------------------------------------ */
/* Razorpay HTTP mock: the server talks to api.razorpay.com through fetch.   */
/* ------------------------------------------------------------------------ */
const createdOrders = new Map<string, { id: string; amount: number }>();
const paymentsById = new Map<string, any>();
let orderCounter = 0;

function installRazorpayMock() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      const auth = init?.headers?.Authorization || '';
      const expectedAuth = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
      if (auth !== expectedAuth) {
        return new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 });
      }
      if (method === 'POST' && url.endsWith('/v1/orders')) {
        const body = JSON.parse(init.body);
        orderCounter += 1;
        const id = `order_TEST${orderCounter.toString().padStart(8, '0')}`;
        createdOrders.set(id, { id, amount: body.amount });
        return new Response(
          JSON.stringify({ id, entity: 'order', amount: body.amount, amount_paid: 0, amount_due: body.amount, currency: 'INR', receipt: body.receipt, status: 'created', notes: body.notes, created_at: Date.now() / 1000 }),
          { status: 200 }
        );
      }
      const m = url.match(/\/v1\/payments\/(pay_[A-Za-z0-9]+)$/);
      if (method === 'GET' && m) {
        const p = paymentsById.get(m[1]);
        if (!p) return new Response(JSON.stringify({ error: { description: 'The id provided does not exist' } }), { status: 400 });
        return new Response(JSON.stringify(p), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { description: `Unmocked ${method} ${url}` } }), { status: 500 });
    })
  );
}

function sign(orderId: string, paymentId: string, secret = env.RAZORPAY_KEY_SECRET!) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function simulateCapturedPayment(orderId: string, amountPaise: number, paymentId = `pay_${crypto.randomBytes(7).toString('hex')}`) {
  const payment = { id: paymentId, entity: 'payment', amount: amountPaise, currency: 'INR', status: 'captured', order_id: orderId, method: 'upi', captured: true, created_at: Date.now() / 1000 };
  paymentsById.set(paymentId, payment);
  return payment;
}

function webhookBody(event: string, payment: any) {
  return JSON.stringify({ entity: 'event', account_id: 'acc_test', event, contains: ['payment'], payload: { payment: { entity: payment } }, created_at: Date.now() / 1000 });
}

function webhookSig(body: string, secret = env.RAZORPAY_WEBHOOK_SECRET!) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('Payments: contributions, Razorpay checkout verification, webhooks and manual fallback', () => {
  beforeAll(async () => {
    await setupTestDB();
    installRazorpayMock();
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await teardownTestDB();
  });
  beforeEach(async () => {
    await clearTestDB();
    createdOrders.clear();
    paymentsById.clear();
  });

  it('test environment has Razorpay test credentials configured (see vitest.config.ts)', () => {
    expect(razorpayConfigured).toBe(true);
    expect(env.RAZORPAY_WEBHOOK_SECRET).toBeTruthy();
  });

  describe('10. Contribution calculation and rounding', () => {
    it('allocates fees proportionally in paise so contributions sum exactly to the final bill', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const b = await createTestUser();
      const { poolId, breakdown } = await buildOrderedPool({
        owner,
        ownerItems: [{ name: 'Owner', quantity: 1, unitPrice: 100 }],
        members: [
          { user: a, items: [{ name: 'A', quantity: 1, unitPrice: 33.33 }] },
          { user: b, items: [{ name: 'B', quantity: 2, unitPrice: 33.33 }] },
        ],
        finalPayableAmount: 233.33, // 199.99 items + 33.34 fees
        deliveryFee: 25,
        otherCharges: 8.34,
      });

      const sum = breakdown.splits.reduce((s: number, x: any) => s + x.totalDue, 0);
      expect(Math.round(sum * 100)).toBe(23333);
      const records = await PaymentRecord.find({ poolId });
      expect(records).toHaveLength(3);
      const recSum = records.reduce((s, r) => s + r.amountPaise, 0);
      expect(recSum).toBe(23333);
      records.forEach((r) => expect(r.amountPaise).toBe(Math.round(r.totalDue * 100)));
    });

    it('a participant sees their own transparent breakdown; non-members are refused', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 180, deliveryFee: 30 });
      const mine = await api().get(`/api/v1/pools/${poolId}/payments/me`).set('Cookie', a.cookie);
      expect(mine.status).toBe(200);
      expect(mine.body.record.itemSubtotal).toBe(50);
      expect(mine.body.record.allocatedFee).toBe(10); // 30 * 50/150
      expect(mine.body.record.totalDue).toBe(60);
      expect(mine.body.payable).toBe(true);

      const stranger = await createTestUser();
      expect((await api().get(`/api/v1/pools/${poolId}/payments/me`).set('Cookie', stranger.cookie)).status).toBe(403);
    });
  });

  describe('11. Unauthorized payment confirmation', () => {
    it('cannot create an order before the retailer order is placed', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const a = await createTestUser();
      await joinPoolViaApi(a, pool._id);
      await addItemViaApi(a, pool._id, { name: 'A', quantity: 1, unitPrice: 50 });
      const res = await api().post(`/api/v1/pools/${pool._id}/payments/razorpay/order`).set('Cookie', a.cookie);
      expect(res.status).toBe(400);
    });

    it('another user cannot verify a payment against someone else’s order, and the host cannot pay themselves', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const b = await createTestUser();
      const { poolId } = await buildOrderedPool({
        owner,
        members: [
          { user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] },
          { user: b, items: [{ name: 'B', quantity: 1, unitPrice: 70 }] },
        ],
        finalPayableAmount: 220,
      });

      const hostOrder = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', owner.cookie);
      expect(hostOrder.status).toBe(400);

      const orderA = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      expect(orderA.status).toBe(201);
      expect(orderA.body.order.amount).toBe(5000);
      expect(orderA.body.keyId).toBe(env.RAZORPAY_KEY_ID);
      expect(JSON.stringify(orderA.body)).not.toContain(env.RAZORPAY_KEY_SECRET);

      const payment = simulateCapturedPayment(orderA.body.order.id, 5000);
      const sig = sign(orderA.body.order.id, payment.id);

      // b tries to claim a's payment
      const hijack = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', b.cookie).send({ razorpay_order_id: orderA.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: sig });
      expect(hijack.status).toBe(403);
      expect((await PaymentRecord.findOne({ poolId, userId: b.user._id }))!.paymentStatus).toBe('PENDING');

      // stranger, not even a member
      const stranger = await createTestUser();
      const outsider = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', stranger.cookie).send({ razorpay_order_id: orderA.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: sig });
      expect(outsider.status).toBe(404);

      // only the host can review manual payments
      const rec = await PaymentRecord.findOne({ poolId, userId: a.user._id });
      const review = await api().post(`/api/v1/pools/${poolId}/payments/${rec!._id}/review`).set('Cookie', b.cookie).send({ status: 'PAID' });
      expect(review.status).toBe(403);
    });

    it('the client-supplied amount is never trusted: the order uses the server-computed paise', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie).send({ amount: 1, amountPaise: 1 });
      expect(order.status).toBe(201);
      expect(order.body.order.amount).toBe(5000);
      expect(createdOrders.get(order.body.order.id)!.amount).toBe(5000);
    });
  });

  describe('12. Invalid Razorpay signatures', () => {
    it('rejects a forged checkout signature and records an audit event', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      const payment = simulateCapturedPayment(order.body.order.id, 5000);

      const forged = sign(order.body.order.id, payment.id, 'wrong_secret');
      const res = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', a.cookie).send({ razorpay_order_id: order.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: forged });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).not.toBe('PAID');
      expect(await AuditEvent.countDocuments({ poolId, action: 'PAYMENT_SIGNATURE_INVALID' })).toBe(1);

      const malformed = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', a.cookie).send({ razorpay_order_id: order.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: 'not-hex' });
      expect(malformed.status).toBe(400);
    });

    it('rejects a webhook with a bad signature and does not change any record', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      const payment = simulateCapturedPayment(order.body.order.id, 5000);
      const body = webhookBody('payment.captured', payment);

      const res = await api()
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', webhookSig(body, 'nope'))
        .set('x-razorpay-event-id', 'evt_bad')
        .send(body);
      expect(res.status).toBe(400);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).toBe('PROCESSING');
      expect(await PaymentEvent.countDocuments()).toBe(0);
    });
  });

  describe('14. Payment status persistence (checkout verification path)', () => {
    it('verifies a genuine signature, confirms capture with the provider and persists PAID exactly once', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).toBe('PROCESSING');

      // Clicking "pay" again reuses the same order instead of creating a new one.
      const again = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      expect(again.status).toBe(200);
      expect(again.body.reused).toBe(true);
      expect(again.body.order.id).toBe(order.body.order.id);

      const payment = simulateCapturedPayment(order.body.order.id, 5000);
      const res = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', a.cookie).send({ razorpay_order_id: order.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: sign(order.body.order.id, payment.id) });
      expect(res.status).toBe(200);
      expect(res.body.contribution.paymentStatus).toBe('PAID');
      expect(res.body.contribution.razorpayPaymentId).toBe(payment.id);

      const rec = await PaymentRecord.findOne({ poolId, userId: a.user._id });
      expect(rec!.paymentStatus).toBe('PAID');
      expect(rec!.paymentMethod).toBe('RAZORPAY');
      expect(rec!.signatureVerifiedAt).toBeInstanceOf(Date);
      expect(rec!.providerConfirmedAt).toBeInstanceOf(Date);
      expect(await AuditEvent.countDocuments({ poolId, action: 'PAYMENT_VERIFIED' })).toBe(1);

      // Replaying the same verification is harmless.
      const replay = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', a.cookie).send({ razorpay_order_id: order.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: sign(order.body.order.id, payment.id) });
      expect(replay.status).toBe(200);
      expect(await AuditEvent.countDocuments({ poolId, action: 'PAYMENT_VERIFIED' })).toBe(1);

      // Paying again is refused.
      const paidAgain = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      expect(paidAgain.status).toBe(409);

      // Host sees the payment id; another member only sees the status.
      const b = await createTestUser();
      const detailHost = await api().get(`/api/v1/pools/${poolId}`).set('Cookie', owner.cookie);
      const hostView = detailHost.body.paymentRecords.find((r: any) => r.userId._id === a.user._id.toString());
      expect(hostView.razorpayPaymentId).toBe(payment.id);
      expect(detailHost.body.outstandingBalance).toBe(0);
      expect((await api().get(`/api/v1/pools/${poolId}`).set('Cookie', b.cookie)).body.paymentRecords).toEqual([]);

      // Payment history reflects it.
      const history = await api().get('/api/v1/payments/history').set('Cookie', a.cookie);
      expect(history.body.records[0].paymentStatus).toBe('PAID');
      expect(history.body.summary.totalPaid).toBe(50);
    });

    it('fails a verification whose captured amount does not match the amount due', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      const payment = simulateCapturedPayment(order.body.order.id, 100); // ₹1 instead of ₹50
      const res = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', a.cookie).send({ razorpay_order_id: order.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: sign(order.body.order.id, payment.id) });
      expect(res.status).toBe(400);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).toBe('FAILED');
    });
  });

  describe('13. Duplicate webhook delivery', () => {
    it('processes a captured webhook once and treats redeliveries as no-ops', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      const payment = simulateCapturedPayment(order.body.order.id, 5000);
      const body = webhookBody('payment.captured', payment);

      const send = () =>
        api()
          .post('/api/v1/payments/razorpay/webhook')
          .set('Content-Type', 'application/json')
          .set('x-razorpay-signature', webhookSig(body))
          .set('x-razorpay-event-id', 'evt_once')
          .send(body);

      const first = await send();
      expect(first.status).toBe(200);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).toBe('PAID');
      expect(await AuditEvent.countDocuments({ poolId, action: 'PAYMENT_VERIFIED' })).toBe(1);

      const second = await send();
      expect(second.status).toBe(200);
      expect(second.body.duplicate).toBe(true);
      const third = await send();
      expect(third.status).toBe(200);

      expect(await AuditEvent.countDocuments({ poolId, action: 'PAYMENT_VERIFIED' })).toBe(1);
      expect(await PaymentEvent.countDocuments({ razorpayPaymentId: payment.id, processingStatus: 'PROCESSED' })).toBeLessThanOrEqual(2);

      // A later checkout verification for the same payment does not double-apply either.
      const verify = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/verify`).set('Cookie', a.cookie).send({ razorpay_order_id: order.body.order.id, razorpay_payment_id: payment.id, razorpay_signature: sign(order.body.order.id, payment.id) });
      expect(verify.status).toBe(200);
      expect(await AuditEvent.countDocuments({ poolId, action: 'PAYMENT_VERIFIED' })).toBe(1);
    });

    it('a payment.failed webhook marks the contribution FAILED but never downgrades a PAID one', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });
      const order = await api().post(`/api/v1/pools/${poolId}/payments/razorpay/order`).set('Cookie', a.cookie);
      const failedPayment = { id: 'pay_failed1', entity: 'payment', amount: 5000, status: 'failed', order_id: order.body.order.id, error_description: 'Insufficient funds' };
      const body = webhookBody('payment.failed', failedPayment);
      const res = await api().post('/api/v1/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig(body)).set('x-razorpay-event-id', 'evt_fail').send(body);
      expect(res.status).toBe(200);
      const rec = await PaymentRecord.findOne({ poolId, userId: a.user._id });
      expect(rec!.paymentStatus).toBe('FAILED');
      expect(rec!.failureReason).toMatch(/Insufficient/);

      // retry succeeds via a captured webhook
      const payment = simulateCapturedPayment(order.body.order.id, 5000);
      const okBody = webhookBody('payment.captured', payment);
      await api().post('/api/v1/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig(okBody)).set('x-razorpay-event-id', 'evt_ok').send(okBody);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).toBe('PAID');

      // a stale failure arriving later cannot downgrade
      const late = webhookBody('payment.failed', { ...failedPayment, id: 'pay_failed2' });
      await api().post('/api/v1/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig(late)).set('x-razorpay-event-id', 'evt_late').send(late);
      expect((await PaymentRecord.findOne({ poolId, userId: a.user._id }))!.paymentStatus).toBe('PAID');
    });

    it('ignores webhooks for unknown orders without failing', async () => {
      const payment = { id: 'pay_unknown', amount: 100, status: 'captured', order_id: 'order_unknown' };
      const body = webhookBody('payment.captured', payment);
      const res = await api().post('/api/v1/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSig(body)).set('x-razorpay-event-id', 'evt_unknown').send(body);
      expect(res.status).toBe(200);
      expect(res.body.ignored).toBe(true);
    });
  });

  describe('Manual UPI fallback (host-verified, clearly labelled)', () => {
    it('submits a reference, host confirms it, and provider-verified payments cannot be overridden', async () => {
      const owner = await createTestUser();
      const a = await createTestUser();
      const { poolId } = await buildOrderedPool({ owner, members: [{ user: a, items: [{ name: 'A', quantity: 1, unitPrice: 50 }] }], finalPayableAmount: 150 });

      const submit = await api().post(`/api/v1/pools/${poolId}/payments/manual`).set('Cookie', a.cookie).send({ paymentReference: 'UPI/409823194821' });
      expect(submit.status).toBe(200);
      expect(submit.body.record.paymentStatus).toBe('PROCESSING');
      expect(submit.body.record.paymentMethod).toBe('MANUAL_UPI');

      const rec = await PaymentRecord.findOne({ poolId, userId: a.user._id });
      const confirm = await api().post(`/api/v1/pools/${poolId}/payments/${rec!._id}/review`).set('Cookie', owner.cookie).send({ status: 'PAID', reviewNote: 'Received in GPay' });
      expect(confirm.status).toBe(200);
      expect(confirm.body.record.paymentStatus).toBe('PAID');
      expect((await PaymentRecord.findById(rec!._id))!.paidAt).toBeInstanceOf(Date);

      const rejectLater = await api().post(`/api/v1/pools/${poolId}/payments/${rec!._id}/review`).set('Cookie', owner.cookie).send({ status: 'FAILED' });
      expect(rejectLater.status).toBe(200); // manual payments can be corrected by the host

      // Provider-verified payments are immutable through review
      await PaymentRecord.updateOne({ _id: rec!._id }, { $set: { paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' } });
      const override = await api().post(`/api/v1/pools/${poolId}/payments/${rec!._id}/review`).set('Cookie', owner.cookie).send({ status: 'FAILED' });
      expect(override.status).toBe(400);
    });
  });
});
