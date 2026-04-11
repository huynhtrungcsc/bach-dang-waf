import express from 'express';
import { exportForSync, importFromMaster, getCurrentConfigHash } from './node-sync.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validateMasterApiKey } from './middleware/replica-auth.middleware';

const router = express.Router();
router.get('/export', validateMasterApiKey, exportForSync);
router.post('/import', authenticate, authorize('admin'), importFromMaster);
router.get('/current-hash', authenticate, getCurrentConfigHash);

export default router;
