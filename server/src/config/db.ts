import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(targetUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    if (env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
