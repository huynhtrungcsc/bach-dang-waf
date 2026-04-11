import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  getSystemConfig,
  updateNodeMode,
  connectToMaster,
  disconnectFromMaster,
  testMasterConnection,
  syncWithMaster,
} from './system-config.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// System configuration routes
router.get('/', getSystemConfig);
router.put('/node-mode', authorize('admin'), updateNodeMode);

// Replica mode routes (admin only — affects cluster topology)
router.post('/connect-master', authorize('admin'), connectToMaster);
router.post('/disconnect-master', authorize('admin'), disconnectFromMaster);
router.post('/test-master-connection', authorize('admin', 'moderator'), testMasterConnection);
router.post('/sync', authorize('admin', 'moderator'), syncWithMaster);

export default router;
