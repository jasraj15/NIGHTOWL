import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { setupTestDB, teardownTestDB, clearTestDB, createTestUser } from './testHelper.js';
import { Pool } from '../models/Pool.js';

describe('Pools API & State Management', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('rejects unauthenticated user from creating a pool', async () => {
    const res = await request(app).post('/api/pools').send({
      title: 'Midnight Zepto',
      retailer: 'Zepto',
      hostel: 'Uniworld 1',
      deliveryZone: 'Main Gate',
      targetAmount: 500,
      closingTime: new Date(Date.now() + 60000).toISOString(),
    });

    expect(res.status).toBe(401);
  });

  it('allows verified student to create a pool with valid future closing time', async () => {
    const { token } = await createTestUser({ hostel: 'Uniworld 1' });

    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${token}`])
      .send({
        title: 'Blinkit Snacks Run',
        retailer: 'Blinkit',
        hostel: 'Uniworld 1',
        deliveryZone: 'Block A Ground Floor',
        targetAmount: 400,
        participantLimit: 6,
        closingTime: futureTime,
        notes: 'Ordering at midnight!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.pool.status).toBe('OPEN');
    expect(res.body.pool.currentSubtotal).toBe(0);
    expect(res.body.pool.participants.length).toBe(1);
  });

  it('filters pools by hostel (Uniworld 1 vs Uniworld 2)', async () => {
    const { user: u1, token: t1 } = await createTestUser({ hostel: 'Uniworld 1' });
    const { user: u2, token: t2 } = await createTestUser({ hostel: 'Uniworld 2' });

    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Pool in Uniworld 1
    await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${t1}`])
      .send({
        title: 'Uniworld 1 Zepto Pool',
        retailer: 'Zepto',
        hostel: 'Uniworld 1',
        deliveryZone: 'U1 Lobby',
        targetAmount: 300,
        closingTime: futureTime,
      });

    // Pool in Uniworld 2
    await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${t2}`])
      .send({
        title: 'Uniworld 2 Blinkit Pool',
        retailer: 'Blinkit',
        hostel: 'Uniworld 2',
        deliveryZone: 'U2 Common Area',
        targetAmount: 300,
        closingTime: futureTime,
      });

    // Query with Uniworld 1 filter
    const u1Res = await request(app).get('/api/pools?hostel=Uniworld 1');
    expect(u1Res.status).toBe(200);
    expect(u1Res.body.pools.length).toBe(1);
    expect(u1Res.body.pools[0].hostel).toBe('Uniworld 1');

    // Query with Uniworld 2 filter
    const u2Res = await request(app).get('/api/pools?hostel=Uniworld 2');
    expect(u2Res.status).toBe(200);
    expect(u2Res.body.pools.length).toBe(1);
    expect(u2Res.body.pools[0].hostel).toBe('Uniworld 2');
  });

  it('prevents duplicate join into the same pool', async () => {
    const { token: ownerToken } = await createTestUser();
    const { token: studentToken } = await createTestUser();

    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const poolRes = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({
        title: 'Zepto Party',
        retailer: 'Zepto',
        hostel: 'Uniworld 1',
        deliveryZone: 'Gate',
        targetAmount: 500,
        closingTime: futureTime,
      });

    const poolId = poolRes.body.pool._id;

    // First join: success
    const joinRes = await request(app)
      .post(`/api/pools/${poolId}/join`)
      .set('Cookie', [`nightowl_token=${studentToken}`]);
    expect(joinRes.status).toBe(200);

    // Duplicate join: error
    const dupRes = await request(app)
      .post(`/api/pools/${poolId}/join`)
      .set('Cookie', [`nightowl_token=${studentToken}`]);
    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toMatch(/already joined/i);
  });

  it('only allows the pool owner to lock the pool', async () => {
    const { token: ownerToken } = await createTestUser();
    const { token: otherToken } = await createTestUser();

    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const poolRes = await request(app)
      .post('/api/pools')
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({
        title: 'Zepto Late Night',
        retailer: 'Zepto',
        hostel: 'Uniworld 1',
        deliveryZone: 'Gate',
        targetAmount: 500,
        closingTime: futureTime,
      });

    const poolId = poolRes.body.pool._id;

    // Add item first
    await request(app)
      .post(`/api/pools/${poolId}/items`)
      .set('Cookie', [`nightowl_token=${ownerToken}`])
      .send({ name: 'Ice Cream', quantity: 1, unitPrice: 150 });

    // Non-owner attempts to lock -> 403 Forbidden
    const unauthLock = await request(app)
      .post(`/api/pools/${poolId}/lock`)
      .set('Cookie', [`nightowl_token=${otherToken}`]);
    expect(unauthLock.status).toBe(403);

    // Owner locks -> 200 OK
    const ownerLock = await request(app)
      .post(`/api/pools/${poolId}/lock`)
      .set('Cookie', [`nightowl_token=${ownerToken}`]);
    expect(ownerLock.status).toBe(200);
    expect(ownerLock.body.pool.status).toBe('LOCKED');
  });
});
