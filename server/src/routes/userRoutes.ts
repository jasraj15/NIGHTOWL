import { Router } from 'express';
import {
  getMe,
  updateProfile,
  selectHostel,
  updatePreferences,
  getMyStats,
  deactivateAccount,
} from '../controllers/authController.js';
import { requireAuth, requireVerifiedCollegeEmail } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/me', getMe);
router.patch('/me', updateProfile);
router.post('/me/hostel', requireVerifiedCollegeEmail, selectHostel);
router.patch('/me/preferences', updatePreferences);
router.get('/me/stats', getMyStats);
router.delete('/me', deactivateAccount);

export default router;
