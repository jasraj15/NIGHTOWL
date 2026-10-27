import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { User, IUser } from '../models/User.js';
import { env } from '../config/env.js';
import { app } from '../app.js';

let mongod: MongoMemoryServer | null = null;

export async function setupTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function teardownTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
}

export interface TestUser {
  user: IUser;
  token: string;
  cookie: string[];
}

export async function createTestUser(overrides: Partial<IUser> = {}): Promise<TestUser> {
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const user = await User.create({
    fullName: 'Test Student',
    email: `test.${Date.now()}.${randomSuffix}@sst.scaler.com`,
    phoneNumber: '9876543210',
    hostel: 'Uniworld 1',
    hostelSelected: true,
    isEmailVerified: true,
    role: 'student',
    ...overrides,
  });

  const token = jwt.sign({ userId: user._id.toString(), email: user.email, hostel: user.hostel }, env.JWT_SECRET, {
    expiresIn: '1d',
  });

  return { user, token, cookie: [`nightowl_token=${token}`] };
}

export const api = () => request(app);

export async function createPoolViaApi(
  owner: TestUser,
  overrides: Record<string, unknown> = {}
): Promise<any> {
  const res = await api()
    .post('/api/v1/pools')
    .set('Cookie', owner.cookie)
    .send({
      title: 'Blinkit Snacks Run',
      retailer: 'Blinkit',
      hostel: 'Uniworld 1',
      deliveryZone: 'Tower A Lobby',
      deliveryConfirmed: true,
      targetAmount: 300,
      durationMinutes: 30,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createPoolViaApi failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.pool;
}

export async function joinPoolViaApi(member: TestUser, poolId: string) {
  return api().post(`/api/v1/pools/${poolId}/join`).set('Cookie', member.cookie).send({ deliveryConfirmed: true });
}

export async function addItemViaApi(
  member: TestUser,
  poolId: string,
  item: { name: string; quantity: number; unitPrice: number; note?: string }
) {
  return api().post(`/api/v1/pools/${poolId}/items`).set('Cookie', member.cookie).send(item);
}

/** Drive a pool from OPEN → ORDERED with the given participants and items. */
export async function buildOrderedPool(opts: {
  owner: TestUser;
  members: Array<{ user: TestUser; items: Array<{ name: string; quantity: number; unitPrice: number }> }>;
  ownerItems?: Array<{ name: string; quantity: number; unitPrice: number }>;
  finalPayableAmount: number;
  deliveryFee?: number;
  otherCharges?: number;
}) {
  const pool = await createPoolViaApi(opts.owner);
  for (const it of opts.ownerItems || [{ name: 'Owner item', quantity: 1, unitPrice: 100 }]) {
    const r = await addItemViaApi(opts.owner, pool._id, it);
    if (r.status !== 201) throw new Error(`owner item failed ${JSON.stringify(r.body)}`);
  }
  for (const m of opts.members) {
    const j = await joinPoolViaApi(m.user, pool._id);
    if (j.status !== 200) throw new Error(`join failed ${JSON.stringify(j.body)}`);
    for (const it of m.items) {
      const r = await addItemViaApi(m.user, pool._id, it);
      if (r.status !== 201) throw new Error(`item failed ${JSON.stringify(r.body)}`);
    }
  }
  const lock = await api().post(`/api/v1/pools/${pool._id}/lock`).set('Cookie', opts.owner.cookie).send({ proceedBelowTargetConfirmed: true });
  if (lock.status !== 200) throw new Error(`lock failed ${JSON.stringify(lock.body)}`);
  const ordered = await api()
    .post(`/api/v1/pools/${pool._id}/order-placed`)
    .set('Cookie', opts.owner.cookie)
    .send({
      finalPayableAmount: opts.finalPayableAmount,
      deliveryFee: opts.deliveryFee ?? 0,
      otherCharges: opts.otherCharges ?? 0,
      upiId: 'host@okaxis',
    });
  if (ordered.status !== 200) throw new Error(`order-placed failed ${JSON.stringify(ordered.body)}`);
  return { poolId: pool._id as string, breakdown: ordered.body.costBreakdown };
}
