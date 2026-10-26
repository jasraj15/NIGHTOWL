import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { setupTestDB, teardownTestDB, clearTestDB, createTestUser } from './testHelper.js';
import { Pool } from '../models/Pool.js';
import { PaymentRecord } from '../models/PaymentRecord.js';

describe('Collaborative Cart & Cost Splitting Payments', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('calculates item subtotals server-side and rejects invalid or negative prices', async () => {
    const { token } = await createTestUser();
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const poolRes = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        title: 'Blinkit Snacks',
        retailer: 'Blinkit',
        hostel: 'Uniworld 1',
        deliveryZone: 'Lobby',
        targetAmount: 500,
        closingTime: futureTime,
      });

    const poolId = poolRes.body.pool._id;

    // Negative price should be rejected
    const negRes = await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        name: 'Bad Item',
        quantity: 1,
        unitPrice: -50,
      });
    expect(negRes.status).toBe(400);

    // Zero quantity should be rejected
    const zeroRes = await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        name: 'Bad Item',
        quantity: 0,
        unitPrice: 50,
      });
    expect(zeroRes.status).toBe(400);

    // Valid item
    const validRes = await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        name: 'Pringles Sour Cream',
        quantity: 3,
        unitPrice: 110,
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.item.itemSubtotal).toBe(330);
    expect(validRes.body.poolSubtotal).toBe(330);
  });

  it('enforces contributionCap so users cannot overspend beyond pool limit', async () => {
    const { token } = await createTestUser();
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const poolRes = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        title: 'Capped Pool',
        retailer: 'Blinkit',
        hostel: 'Uniworld 1',
        deliveryZone: 'Lobby',
        targetAmount: 1000,
        contributionCap: 200, // Maximum ₹200 per user
        closingTime: futureTime,
      });

    const poolId = poolRes.body.pool._id;

    // Item exceeding cap (₹300 > ₹200) -> 400
    const overCapRes = await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        name: 'Fancy Cake',
        quantity: 1,
        unitPrice: 300,
      });

    expect(overCapRes.status).toBe(400);
    expect(overCapRes.body.error).toMatch(/contribution cap/i);
  });

  it('prevents item modification after pool is locked', async () => {
    const { token } = await createTestUser();
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const poolRes = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        title: 'Lock Test Pool',
        retailer: 'Blinkit',
        hostel: 'Uniworld 1',
        deliveryZone: 'Lobby',
        targetAmount: 500,
        closingTime: futureTime,
      });

    const poolId = poolRes.body.pool._id;

    // Add item
    const itemRes = await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${token}`])
      .send({ name: 'Chocolates', quantity: 1, unitPrice: 100 });
    const itemId = itemRes.body.item._id;

    // Lock pool
    await request(app)
      .post(`/api/pools/${poolId}/lock`)
      .set('Cookie', [`nightowl_token=${token}`]);

    // Attempt to add new item -> 400
    const addAfterLock = await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${token}`])
      .send({ name: 'Chips', quantity: 1, unitPrice: 50 });
    expect(addAfterLock.status).toBe(400);

    // Attempt to delete item -> 400
    const delAfterLock = await request(app)
      .delete(`/api/pools/${poolId}/items/${itemId}`)
      .set('Cookie', [`nightowl_token=${token}`]);
    expect(delAfterLock.status).toBe(400);
  });

  it('tracks payment reference submission and authorizes owner verification', async () => {
    const { user: owner, token: ownerToken } = await createTestUser();
    const { user: student, token: studentToken } = await createTestUser();

    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const poolRes = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({
        title: 'Payment Workflow Pool',
        retailer: 'Zepto',
        hostel: 'Uniworld 1',
        deliveryZone: 'Lobby',
        targetAmount: 400,
        closingTime: futureTime,
      });

    const poolId = poolRes.body.pool._id;

    // Student joins and adds item
    await request(app)
      .post(`/api/pools/${poolId}/join`)
      .set('Cookie', [`nightowl_token=${studentToken}`]);

    await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${studentToken}`])
      .send({ name: 'Ice Cream', quantity: 2, unitPrice: 100 }); // 200

    // Owner adds item
    await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({ name: 'Soda', quantity: 2, unitPrice: 50 }); // 100

    // Owner locks pool
    await request(app)
      .post(`/api/pools/${poolId}/lock`)
      .set('Cookie', [`nightowl_token=${ownerToken}`]);

    // Owner places order with ₹30 delivery fee (Total = 330)
    const orderRes = await request(app)
      .post(`/api/pools/${poolId}/order-placed`)
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({
        finalPayableAmount: 330,
        deliveryFee: 30,
        upiId: 'owner@upi',
      });

    expect(orderRes.status).toBe(200);

    // Student submits UPI payment reference
    const paySubmit = await request(app)
      .post(`/api/pools/${poolId}/payment`)
      .set('Cookie', [`nightowl_token=${studentToken}`])
      .send({ paymentReference: 'UPI/123456789012' });

    expect(paySubmit.status).toBe(200);
    expect(paySubmit.body.record.paymentStatus).toBe('SUBMITTED');

    const paymentRecordId = paySubmit.body.record._id;

    // Non-owner attempts to confirm payment -> 403 Forbidden
    const unauthReview = await request(app)
      .post(`/api/pools/${poolId}/payment/${paymentRecordId}/review`)
      .set('Cookie', [`nightowl_token=${studentToken}`])
      .send({ status: 'CONFIRMED' });
    expect(unauthReview.status).toBe(403);

    // Owner confirms payment -> 200 OK
    const ownerReview = await request(app)
      .post(`/api/pools/${poolId}/payment/${paymentRecordId}/review`)
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({ status: 'CONFIRMED', reviewNote: 'Received in GPay' });

    expect(ownerReview.status).toBe(200);
    expect(ownerReview.body.record.paymentStatus).toBe('CONFIRMED');
    expect(ownerReview.body.record.reviewNote).toBe('Received in GPay');
  });
});
