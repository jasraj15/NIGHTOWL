import { Router } from 'express';
import {
  getPools,
  getRecommendedPools,
  createPool,
  getPoolById,
  joinPool,
  leavePool,
  lockPool,
  reopenPool,
  extendPool,
  confirmOrderPlaced,
  markDelivered,
  cancelPool,
  getMyOrders,
  getMyPoolHistory,
  getDuplicateDraft,
  reportPool,
} from '../controllers/poolController.js';
import { requireAuth, requireVerifiedCollegeEmail } from '../middlewares/auth.js';

const router = Router();

// Everything about pools requires a verified student session (discovery included).
router.use(requireAuth, requireVerifiedCollegeEmail);

router.get('/', getPools);
router.get('/recommended', getRecommendedPools);
router.get('/orders/mine', getMyOrders);
router.get('/history/my', getMyPoolHistory);
router.post('/', createPool);

router.get('/:id', getPoolById);
router.get('/:id/duplicate-draft', getDuplicateDraft);

router.post('/:id/join', joinPool);
router.post('/:id/leave', leavePool);
router.post('/:id/report', reportPool);

// Lifecycle (owner only — enforced in controllers)
router.post('/:id/lock', lockPool);
router.post('/:id/reopen', reopenPool);
router.post('/:id/extend', extendPool);
router.post('/:id/order-placed', confirmOrderPlaced);
router.post('/:id/complete', confirmOrderPlaced);
router.post('/:id/deliver', markDelivered);
router.post('/:id/cancel', cancelPool);

export default router;
