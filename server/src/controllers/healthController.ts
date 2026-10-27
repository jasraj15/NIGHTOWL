import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { env, razorpayConfigured } from '../config/env.js';

export function healthHandler(_req: Request, res: Response): void {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'NightOwl API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: env.NODE_ENV,
    payments: razorpayConfigured ? 'razorpay' : 'manual-fallback',
  });
}
