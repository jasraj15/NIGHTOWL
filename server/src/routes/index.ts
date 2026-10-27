import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import poolRoutes from './poolRoutes.js';
import itemRoutes from './itemRoutes.js';
import { poolPaymentRoutes, paymentRoutes } from './paymentRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import adminRoutes from './adminRoutes.js';
import { healthHandler } from '../controllers/healthController.js';

/** Versioned API router. Mounted at /api/v1 (and /api for backwards compatibility). */
export function buildApiRouter(): Router {
  const api = Router();
  api.get('/health', healthHandler);
  api.use('/auth', authRoutes);
  api.use('/users', userRoutes);
  // Order matters: item + payment sub-routes declare more specific paths than /pools/:id
  api.use('/pools', itemRoutes);
  api.use('/pools', poolPaymentRoutes);
  api.use('/pools', poolRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/admin', adminRoutes);
  return api;
}
