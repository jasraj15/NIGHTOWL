import { Router } from 'express';
import {
  getPools,
  createPool,
  getPoolById,
  joinPool,
  leavePool,
  lockPool,
  confirmOrderPlaced,
  markDelivered,
  cancelPool,
  getMyPoolHistory,
} from '../controllers/poolController.js';
import { requireAuth, requireVerifiedCollegeEmail } from '../middlewares/auth.js';

const router = Router();

// Public discovery of open pools (or for authenticated users)
router.get('/', getPools);

// User's own pool history
router.get('/history/my', requireAuth, getMyPoolHistory);

// Single pool details
router.get('/:id', getPoolById);

// Pool creation (requires verified college email)
router.post('/', requireAuth, requireVerifiedCollegeEmail, createPool);

// Pool membership
router.post('/:id/join', requireAuth, requireVerifiedCollegeEmail, joinPool);
router.post('/:id/leave', requireAuth, leavePool);

// Pool lifecycle (Owner only)
router.post('/:id/lock', requireAuth, lockPool);
router.post('/:id/order-placed', requireAuth, confirmOrderPlaced);
router.post('/:id/deliver', requireAuth, markDelivered);
router.post('/:id/cancel', requireAuth, cancelPool);

export default router;
