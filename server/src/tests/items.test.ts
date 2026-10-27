import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { PoolItem } from '../models/PoolItem.js';

describe('Collaborative cart items', () => {
  beforeAll(setupTestDB);
  afterAll(teardownTestDB);
  beforeEach(clearTestDB);

  describe('7. Item validation and server-side totals', () => {
    it('rejects negative prices, zero/fractional quantities and oversized values', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);

      expect((await addItemViaApi(owner, pool._id, { name: 'Bad', quantity: 1, unitPrice: -50 })).status).toBe(400);
      expect((await addItemViaApi(owner, pool._id, { name: 'Bad', quantity: 0, unitPrice: 50 })).status).toBe(400);
      expect((await addItemViaApi(owner, pool._id, { name: 'Bad', quantity: 1.5, unitPrice: 50 })).status).toBe(400);
      expect((await addItemViaApi(owner, pool._id, { name: '', quantity: 1, unitPrice: 50 })).status).toBe(400);
      expect((await addItemViaApi(owner, pool._id, { name: 'Bad', quantity: 1, unitPrice: 999999 })).status).toBe(400);
    });

    it('computes subtotals on the server and ignores any client-supplied subtotal', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const res = await api()
        .post(`/api/v1/pools/${pool._id}/items`)
        .set('Cookie', owner.cookie)
        .send({ name: 'Red Bull', quantity: 3, unitPrice: 125.5, itemSubtotal: 1 });
      expect(res.status).toBe(201);
      expect(res.body.item.itemSubtotal).toBe(376.5);
      expect(res.body.poolSubtotal).toBe(376.5);

      const detail = await api().get(`/api/v1/pools/${pool._id}`).set('Cookie', owner.cookie);
      expect(detail.body.pool.currentSubtotal).toBe(376.5);
      expect(detail.body.pool.remainingAmount).toBe(0);
      expect(detail.body.pool.progressPercent).toBe(100);
    });

    it('non-participants cannot add items; only owners can edit their own items', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      const stranger = await createTestUser();
      const blocked = await addItemViaApi(stranger, pool._id, { name: 'Sneaky', quantity: 1, unitPrice: 10 });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('NOT_A_PARTICIPANT');

      const member = await createTestUser();
      await joinPoolViaApi(member, pool._id);
      const mine = await addItemViaApi(member, pool._id, { name: 'Mine', quantity: 1, unitPrice: 40 });
      expect(mine.status).toBe(201);

      const ownerEdit = await api().patch(`/api/v1/pools/${pool._id}/items/${mine.body.item._id}`).set('Cookie', owner.cookie).send({ quantity: 9 });
      expect(ownerEdit.status).toBe(403);

      const selfEdit = await api().patch(`/api/v1/pools/${pool._id}/items/${mine.body.item._id}`).set('Cookie', member.cookie).send({ quantity: 2, unitPrice: 45 });
      expect(selfEdit.status).toBe(200);
      expect(selfEdit.body.item.itemSubtotal).toBe(90);

      // Pool host may remove any item (moderation), stranger may not.
      expect((await api().delete(`/api/v1/pools/${pool._id}/items/${mine.body.item._id}`).set('Cookie', stranger.cookie)).status).toBe(403);
      expect((await api().delete(`/api/v1/pools/${pool._id}/items/${mine.body.item._id}`).set('Cookie', owner.cookie)).status).toBe(200);
      expect(await PoolItem.countDocuments({ poolId: pool._id })).toBe(0);
    });

    it('enforces the per-person contribution cap', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner, { contributionCap: 100 });
      expect((await addItemViaApi(owner, pool._id, { name: 'A', quantity: 1, unitPrice: 80 })).status).toBe(201);
      const over = await addItemViaApi(owner, pool._id, { name: 'B', quantity: 1, unitPrice: 30 });
      expect(over.status).toBe(400);
      expect(over.body.error).toMatch(/cap/i);
    });
  });

  describe('8. Concurrent item updates and safe state changes', () => {
    it('keeps the pool subtotal exact when many participants add items at once', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner, { participantLimit: 10 });
      const members = await Promise.all([1, 2, 3, 4].map(() => createTestUser()));
      for (const m of members) await joinPoolViaApi(m, pool._id);

      const adds = [
        ...members.map((m, i) => addItemViaApi(m, pool._id, { name: `Item ${i}`, quantity: i + 1, unitPrice: 10 })),
        addItemViaApi(owner, pool._id, { name: 'Owner', quantity: 2, unitPrice: 25.25 }),
        addItemViaApi(owner, pool._id, { name: 'Owner 2', quantity: 1, unitPrice: 1.99 }),
      ];
      const results = await Promise.all(adds);
      results.forEach((r) => expect(r.status).toBe(201));

      const expected = Math.round((10 + 20 + 30 + 40 + 50.5 + 1.99) * 100) / 100;
      const detail = await api().get(`/api/v1/pools/${pool._id}`).set('Cookie', owner.cookie);
      expect(detail.body.items).toHaveLength(6);
      expect(detail.body.pool.currentSubtotal).toBe(expected);
      expect((await Pool.findById(pool._id))!.currentSubtotal).toBe(expected);
    });

    it('concurrent lock requests result in exactly one LOCKED transition', async () => {
      const owner = await createTestUser();
      const pool = await createPoolViaApi(owner);
      await addItemViaApi(owner, pool._id, { name: 'X', quantity: 3, unitPrice: 100 });
      const results = await Promise.all(
        [1, 2, 3].map(() => api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', owner.cookie).send({}))
      );
      const ok = results.filter((r) => r.status === 200).length;
      expect(ok).toBe(1);
      expect((await Pool.findById(pool._id))!.status).toBe('LOCKED');
    });
  });
});
