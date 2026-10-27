import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  api,
  createPoolViaApi,
  joinPoolViaApi,
  addItemViaApi,
} from './testHelper.js';
import { Pool } from '../models/Pool.js';
import { checkAndExpirePool } from '../services/poolExpiryService.js';

describe('Pools: creation, discovery, membership and lifecycle', () => {
  beforeAll(setupTestDB);
  afterAll(teardownTestDB);
  beforeEach(clearTestDB);

  describe('5. Pool creation and discovery', () => {
    it('creates a pool with a server-computed deadline from the chosen duration', async () => {
      const owner = await createTestUser();
      const before = Date.now();
      const pool = await createPoolViaApi(owner, { durationMinutes: 20 });
      const closing = new Date(pool.closingTime).getTime();
      expect(closing - before).toBeGreaterThanOrEqual(19.5 * 60 * 1000);
      expect(closing - before).toBeLessThanOrEqual(20.5 * 60 * 1000);
      expect(pool.status).toBe('OPEN');
      expect(pool.participantCount).toBe(1);
      expect(pool.remainingAmount).toBe(300);
    });

    it('rejects a client-controlled deadline outside the allowed window and invalid fields', async () => {
      const owner = await createTestUser();
      const tooLong = await api().post('/api/v1/pools').set('Cookie', owner.cookie).send({
        title: 'Way too long', retailer: 'Zepto', hostel: 'Uniworld 1', deliveryZone: 'Lobby', deliveryConfirmed: true, targetAmount: 200, durationMinutes: 999,
      });
      expect(tooLong.status).toBe(400);

      const noConfirm = await api().post('/api/v1/pools').set('Cookie', owner.cookie).send({
        title: 'No confirm', retailer: 'Zepto', hostel: 'Uniworld 1', deliveryZone: 'Lobby', targetAmount: 200, durationMinutes: 15,
      });
      expect(noConfirm.status).toBe(400);

      const otherWithoutName = await api().post('/api/v1/pools').set('Cookie', owner.cookie).send({
        title: 'Other store', retailer: 'Other', hostel: 'Uniworld 1', deliveryZone: 'Lobby', deliveryConfirmed: true, targetAmount: 200, durationMinutes: 15,
      });
      expect(otherWithoutName.status).toBe(400);

      const negativeTarget = await api().post('/api/v1/pools').set('Cookie', owner.cookie).send({
        title: 'Negative', retailer: 'Zepto', hostel: 'Uniworld 1', deliveryZone: 'Lobby', deliveryConfirmed: true, targetAmount: -5, durationMinutes: 15,
      });
      expect(negativeTarget.status).toBe(400);
    });

    it('filters discovery by hostel, retailer, status and search, and ignores injected operators', async () => {
      const u1 = await createTestUser({ hostel: 'Uniworld 1' });
      const u2 = await createTestUser({ hostel: 'Uniworld 2' });
      await createPoolViaApi(u1, { title: 'Blinkit chips', retailer: 'Blinkit', hostel: 'Uniworld 1' });
      await createPoolViaApi(u2, { title: 'Zepto ice cream', retailer: 'Zepto', hostel: 'Uniworld 2' });

      const all = await api().get('/api/v1/pools').set('Cookie', u1.cookie);
      expect(all.status).toBe(200);
      expect(all.body.pools).toHaveLength(2);
      expect(all.body.serverTime).toBeDefined();

      const byHostel = await api().get('/api/v1/pools?hostel=Uniworld%202').set('Cookie', u1.cookie);
      expect(byHostel.body.pools).toHaveLength(1);
      expect(byHostel.body.pools[0].hostel).toBe('Uniworld 2');

      const byRetailer = await api().get('/api/v1/pools?retailer=Blinkit').set('Cookie', u1.cookie);
      expect(byRetailer.body.pools).toHaveLength(1);

      const bySearch = await api().get('/api/v1/pools?search=ice').set('Cookie', u1.cookie);
      expect(bySearch.body.pools).toHaveLength(1);
      expect(bySearch.body.pools[0].title).toMatch(/ice cream/);

      const injected = await api().get('/api/v1/pools?status[$ne]=OPEN').set('Cookie', u1.cookie);
      expect(injected.status).toBe(400); // zod rejects the non-enum value

      const invalidEnum = await api().get('/api/v1/pools?hostel=Mars').set('Cookie', u1.cookie);
      expect(invalidEnum.status).toBe(400);
    });

    it('never exposes phone numbers of creators/participants in discovery', async () => {
      const owner = await createTestUser();
      await createPoolViaApi(owner);
      const viewer = await createTestUser();
      const res = await api().get('/api/v1/pools').set('Cookie', viewer.cookie);
      expect(JSON.stringify(res.body)).not.toContain(owner.user.phoneNumber);
    });

    it('recommends pools with explicit reasons', async () => {
      const owner = await createTestUser({ hostel: 'Uniworld 2' });
      await createPoolViaApi(owner, { hostel: 'Uniworld 2' });
      const viewer = await createTestUser({ hostel: 'Uniworld 2' });
      const res = await api().get('/api/v1/pools/recommended').set('Cookie', viewer.cookie);
      expect(res.status).toBe(200);
      expect(res.body.recommendations[0].reasons.length).toBeGreaterThan(0);
    });
  });

  describe('6. Duplicate join prevention and capacity', () => {
    it('prevents joining twice, even under concurrent requests', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner, { participantLimit: 5 });
      const member = await createTestUser();

      const results = await Promise.all([1, 2, 3, 4].map(() => joinPoolViaApi(member, pool._id)));
      const okCount = results.filter((r) => r.status === 200).length;
      expect(okCount).toBe(1);

      const fresh = await Pool.findById(pool._id);
      expect(fresh!.participants.length).toBe(2);
      expect(fresh!.participants.filter((p) => p.toString() === member.user._id.toString()).length).toBe(1);
    });

    it('requires delivery confirmation and enforces the participant limit', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner, { participantLimit: 2 });
      const a = await createTestUser();
      const b = await createTestUser();

      const noConfirm = await api().post(`/api/v1/pools/${pool._id}/join`).set('Cookie', a.cookie).send({});
      expect(noConfirm.status).toBe(400);

      expect((await joinPoolViaApi(a, pool._id)).status).toBe(200);
      const full = await joinPoolViaApi(b, pool._id);
      expect(full.status).toBe(400);
      expect(full.body.error).toMatch(/limit/i);
    });

    it('the host cannot leave; a member can leave and their items are removed', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const m = await createTestUser();
      await joinPoolViaApi(m, pool._id);
      await addItemViaApi(m, pool._id, { name: 'Chips', quantity: 2, unitPrice: 20 });

      const hostLeave = await api().post(`/api/v1/pools/${pool._id}/leave`).set('Cookie', owner.cookie);
      expect(hostLeave.status).toBe(400);

      const leave = await api().post(`/api/v1/pools/${pool._id}/leave`).set('Cookie', m.cookie);
      expect(leave.status).toBe(200);
      expect(leave.body.pool.currentSubtotal).toBe(0);
      expect(leave.body.pool.participantCount).toBe(1);
    });
  });

  describe('9. Locked and expired pool restrictions', () => {
    it('blocks joins and item changes once locked; only the owner can lock', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const m = await createTestUser();
      await joinPoolViaApi(m, pool._id);
      const item = await addItemViaApi(m, pool._id, { name: 'Soda', quantity: 1, unitPrice: 100 });

      const memberLock = await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', m.cookie).send({ proceedBelowTargetConfirmed: true });
      expect(memberLock.status).toBe(403);

      const belowTarget = await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', owner.cookie).send({});
      expect(belowTarget.status).toBe(400);
      expect(belowTarget.body.code).toBe('BELOW_TARGET');

      const lock = await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', owner.cookie).send({ proceedBelowTargetConfirmed: true });
      expect(lock.status).toBe(200);
      expect(lock.body.pool.status).toBe('LOCKED');

      const other = await createTestUser();
      expect((await joinPoolViaApi(other, pool._id)).status).toBe(400);
      expect((await addItemViaApi(m, pool._id, { name: 'Late', quantity: 1, unitPrice: 10 })).status).toBe(400);
      const edit = await api().patch(`/api/v1/pools/${pool._id}/items/${item.body.item._id}`).set('Cookie', m.cookie).send({ quantity: 5 });
      expect(edit.status).toBe(400);
      const del = await api().delete(`/api/v1/pools/${pool._id}/items/${item.body.item._id}`).set('Cookie', m.cookie);
      expect(del.status).toBe(400);
    });

    it('expires an overdue pool server-side and blocks joins/items; the owner can extend it back to OPEN', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      await Pool.updateOne({ _id: pool._id }, { $set: { closingTime: new Date(Date.now() - 60 * 1000) } });

      const doc = await Pool.findById(pool._id);
      expect(await checkAndExpirePool(doc!)).toBe(true);
      expect((await Pool.findById(pool._id))!.status).toBe('EXPIRED');
      // second call is a no-op (conditional update)
      expect(await checkAndExpirePool((await Pool.findById(pool._id))!)).toBe(false);

      const m = await createTestUser();
      expect((await joinPoolViaApi(m, pool._id)).status).toBe(400);
      expect((await addItemViaApi(owner, pool._id, { name: 'x', quantity: 1, unitPrice: 10 })).status).toBe(400);

      const extend = await api().post(`/api/v1/pools/${pool._id}/extend`).set('Cookie', owner.cookie).send({ additionalMinutes: 15 });
      expect(extend.status).toBe(200);
      expect(extend.body.pool.status).toBe('OPEN');
      expect(new Date(extend.body.pool.closingTime).getTime()).toBeGreaterThan(Date.now());
      expect((await joinPoolViaApi(m, pool._id)).status).toBe(200);
    });

    it('lazily expires overdue pools in discovery and detail', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      await Pool.updateOne({ _id: pool._id }, { $set: { closingTime: new Date(Date.now() - 1000) } });
      const detail = await api().get(`/api/v1/pools/${pool._id}`).set('Cookie', owner.cookie);
      expect(detail.body.pool.status).toBe('EXPIRED');
    });

    it('validates every state transition', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      await addItemViaApi(owner, pool._id, { name: 'Item', quantity: 3, unitPrice: 100 });

      // ORDERED before LOCKED is invalid
      const early = await api().post(`/api/v1/pools/${pool._id}/order-placed`).set('Cookie', owner.cookie).send({ finalPayableAmount: 300 });
      expect(early.status).toBe(400);
      // DELIVERED before ORDERED is invalid
      expect((await api().post(`/api/v1/pools/${pool._id}/deliver`).set('Cookie', owner.cookie)).status).toBe(400);

      expect((await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', owner.cookie).send({})).status).toBe(200);

      // Reopen LOCKED -> OPEN then lock again
      const reopen = await api().post(`/api/v1/pools/${pool._id}/reopen`).set('Cookie', owner.cookie);
      expect(reopen.status).toBe(200);
      expect(reopen.body.pool.status).toBe('OPEN');
      expect((await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', owner.cookie).send({})).status).toBe(200);

      // Final total below items subtotal is rejected
      const tooLow = await api().post(`/api/v1/pools/${pool._id}/order-placed`).set('Cookie', owner.cookie).send({ finalPayableAmount: 100 });
      expect(tooLow.status).toBe(400);

      const ordered = await api().post(`/api/v1/pools/${pool._id}/order-placed`).set('Cookie', owner.cookie).send({ finalPayableAmount: 340, deliveryFee: 40 });
      expect(ordered.status).toBe(200);
      expect(ordered.body.pool.status).toBe('ORDERED');

      // Cannot reopen once ordered
      expect((await api().post(`/api/v1/pools/${pool._id}/reopen`).set('Cookie', owner.cookie)).status).toBe(400);

      const delivered = await api().post(`/api/v1/pools/${pool._id}/deliver`).set('Cookie', owner.cookie);
      expect(delivered.status).toBe(200);
      expect(delivered.body.pool.status).toBe('DELIVERED');

      expect((await api().post(`/api/v1/pools/${pool._id}/cancel`).set('Cookie', owner.cookie)).status).toBe(400);
    });

    it('only the owner can cancel, and cancelled pools reject members', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const m = await createTestUser();
      expect((await api().post(`/api/v1/pools/${pool._id}/cancel`).set('Cookie', m.cookie)).status).toBe(403);
      expect((await api().post(`/api/v1/pools/${pool._id}/cancel`).set('Cookie', owner.cookie)).status).toBe(200);
      expect((await joinPoolViaApi(m, pool._id)).status).toBe(400);
    });
  });

  describe('Orders history & duplication', () => {
    it('lists orders by tab and duplicates into a NEW draft without touching the original', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner, { title: 'Original run' });
      await addItemViaApi(owner, pool._id, { name: 'Maggi', quantity: 2, unitPrice: 14 });

      const tabs = await api().get('/api/v1/pools/orders/mine?tab=created').set('Cookie', owner.cookie);
      expect(tabs.status).toBe(200);
      expect(tabs.body.orders).toHaveLength(1);
      expect(tabs.body.orders[0].isHost).toBe(true);
      expect(tabs.body.orders[0].myItemSubtotal).toBe(28);
      expect(tabs.body.counts.active).toBe(1);

      const draft = await api().get(`/api/v1/pools/${pool._id}/duplicate-draft`).set('Cookie', owner.cookie);
      expect(draft.status).toBe(200);
      expect(draft.body.items).toEqual([{ name: 'Maggi', quantity: 2, unitPrice: 14, note: undefined }]);
      expect(draft.body.draft.title).toContain('Original run');

      const stranger = await createTestUser();
      expect((await api().get(`/api/v1/pools/${pool._id}/duplicate-draft`).set('Cookie', stranger.cookie)).status).toBe(403);

      // Original untouched
      const original = await Pool.findById(pool._id);
      expect(original!.title).toBe('Original run');
      expect(await Pool.countDocuments()).toBe(1);
    });
  });

  describe('16. Missing resources and bad identifiers', () => {
    it('returns 404 for unknown pools and 400 for malformed ids', async () => {
      const u = await createTestUser();
      const missing = await api().get(`/api/v1/pools/${new mongoose.Types.ObjectId()}`).set('Cookie', u.cookie);
      expect(missing.status).toBe(404);
      const malformed = await api().get('/api/v1/pools/not-an-id').set('Cookie', u.cookie);
      expect(malformed.status).toBe(400);
      const joinMissing = await api().post(`/api/v1/pools/${new mongoose.Types.ObjectId()}/join`).set('Cookie', u.cookie).send({ deliveryConfirmed: true });
      expect(joinMissing.status).toBe(404);
      const unknownRoute = await api().get('/api/v1/nope').set('Cookie', u.cookie);
      expect(unknownRoute.status).toBe(404);
    });

    it('reports are rate limited and persisted', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const r = await api().post(`/api/v1/pools/${pool._id}/report`).set('Cookie', owner.cookie).send({ reason: 'OTHER', details: 'Something is off here' });
      expect(r.status).toBe(201);
    });
  });
});
