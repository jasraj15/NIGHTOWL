import { Router } from 'express';
import { addItem, updateItem, deleteItem } from '../controllers/itemController.js';
import { requireAuth, requireVerifiedCollegeEmail } from '../middlewares/auth.js';

const router = Router();

// Mounted under /pools
router.post('/:poolId/items', requireAuth, requireVerifiedCollegeEmail, addItem);
router.patch('/:poolId/items/:itemId', requireAuth, requireVerifiedCollegeEmail, updateItem);
router.delete('/:poolId/items/:itemId', requireAuth, requireVerifiedCollegeEmail, deleteItem);

export default router;
