import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { chatHandler } from './ai.controller';

const router = Router();

// All AI routes require authentication; admin and moderator (operator) only
router.use(authenticate);
router.post('/chat', authorize('admin', 'moderator'), chatHandler);

export default router;
