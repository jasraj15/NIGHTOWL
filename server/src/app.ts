import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { generalApiLimiter } from './middlewares/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import poolRoutes from './routes/poolRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

export const app = express();

// Security middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible SPA serving / dev tooling
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply general rate limit to all API routes in production
if (env.NODE_ENV === 'production') {
  app.use('/api', generalApiLimiter);
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    service: 'NightOwl API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: env.NODE_ENV,
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/pools', itemRoutes);
app.use('/api/pools', paymentRoutes);
app.use('/api/pools', poolRoutes);

// 404 Catch-all handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handler
app.use(errorHandler);
