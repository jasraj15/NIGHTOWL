import { Router } from 'express';
import { listReports, reviewReport, platformAnalytics } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

// Server-side role enforcement: only moderators reach these handlers.
router.use(requireAuth, requireRole('moderator'));
router.get('/reports', listReports);
router.patch('/reports/:id', reviewReport);
router.get('/analytics', platformAnalytics);

export default router;
