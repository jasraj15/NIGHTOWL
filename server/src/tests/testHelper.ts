import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { env } from '../config/env.js';

let mongod: MongoMemoryServer | null = null;

export async function setupTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function teardownTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export async function createTestUser(overrides: Partial<IUser> = {}): Promise<{ user: IUser; token: string }> {
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const user = await User.create({
    fullName: 'Test Student',
    email: `test.${Date.now()}.${randomSuffix}@sst.scaler.com`,
    phoneNumber: '9876543210',
    hostel: 'Uniworld 1',
    isEmailVerified: true,
    role: 'student',
    ...overrides,
  });

  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      hostel: user.hostel,
    },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return { user, token };
}
