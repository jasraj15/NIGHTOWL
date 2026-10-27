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
import { Notification } from '../models/Notification.js';

describe('15. Notifications and access control', () => {
  beforeAll(setupTestDB);
  afterAll(teardownTestDB);
  beforeEach(clearTestDB);

  it('notifies the host when someone joins, and only the recipient can read or mark it', async () => {
    const owner = await createTestUser();
    const pool = await createPoolViaApi(owner, { title: 'Late snacks' });
    const member = await createTestUser();
    await joinPoolViaApi(member, pool._id);

    const hostList = await api().get('/api/v1/notifications').set('Cookie', owner.cookie);
    expect(hostList.status).toBe(200);
    expect(hostList.body.unreadCount).toBe(1);
    expect(hostList.body.notifications[0].type).toBe('PARTICIPANT_JOINED');
    expect(hostList.body.notifications[0].poolId).toBe(pool._id);
    const notifId = hostList.body.notifications[0]._id;

    // The member sees nothing of the host's notifications.
    const memberList = await api().get('/api/v1/notifications').set('Cookie', member.cookie);
    expect(memberList.body.notifications).toHaveLength(0);

    // Another user cannot mark the host's notification as read.
    const foreign = await api().patch(`/api/v1/notifications/${notifId}/read`).set('Cookie', member.cookie);
    expect(foreign.status).toBe(404);
    expect((await Notification.findById(notifId))!.read).toBe(false);

    const own = await api().patch(`/api/v1/notifications/${notifId}/read`).set('Cookie', owner.cookie);
    expect(own.status).toBe(200);
    expect(own.body.unreadCount).toBe(0);

    const unauth = await api().get('/api/v1/notifications');
    expect(unauth.status).toBe(401);

    const me = await api().get('/api/v1/auth/me').set('Cookie', owner.cookie);
    expect(me.body.unreadNotifications).toBe(0);
  });

  it('respects notification preferences and supports mark-all-read and delete', async () => {
    const owner = await createTestUser();
    await api().patch('/api/v1/users/me/preferences').set('Cookie', owner.cookie).send({ notifications: { someoneJoinsMyPool: false } });
    const pool = await createPoolViaApi(owner);
    const m1 = await createTestUser();
    await joinPoolViaApi(m1, pool._id);
    expect(await Notification.countDocuments({ recipient: owner.user._id, type: 'PARTICIPANT_JOINED' })).toBe(0);

    // Lock notifies members (order updates still on)
    await addItemViaApi(m1, pool._id, { name: 'X', quantity: 1, unitPrice: 300 });
    await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', owner.cookie).send({});
    const m1List = await api().get('/api/v1/notifications?unread=true').set('Cookie', m1.cookie);
    expect(m1List.body.notifications.some((n: any) => n.type === 'ORDER_UPDATE')).toBe(true);

    const all = await api().post('/api/v1/notifications/read-all').set('Cookie', m1.cookie);
    expect(all.status).toBe(200);
    expect((await api().get('/api/v1/notifications?unread=true').set('Cookie', m1.cookie)).body.notifications).toHaveLength(0);

    const first = (await api().get('/api/v1/notifications').set('Cookie', m1.cookie)).body.notifications[0];
    expect((await api().delete(`/api/v1/notifications/${first._id}`).set('Cookie', owner.cookie)).status).toBe(404);
    expect((await api().delete(`/api/v1/notifications/${first._id}`).set('Cookie', m1.cookie)).status).toBe(200);
  });
});
