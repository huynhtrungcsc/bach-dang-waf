import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  get2FAStatus,
  setup2FA,
  enable2FA,
  disable2FA,
  getActivityLogs,
  getSessions,
  revokeSession,
} from './account.controller';
import { authenticate } from '../../middleware/auth';
import {
  updateProfileValidation,
  changePasswordValidation,
  enable2FAValidation,
} from './account.validation';

const router: ExpressRouter = Router();

// All routes require authentication
router.use(authenticate);
router.get('/profile', getProfile);
router.put('/profile', updateProfileValidation, updateProfile);
router.post('/password', changePasswordValidation, changePassword);
router.get('/2fa', get2FAStatus);
router.post('/2fa/setup', setup2FA);
router.post('/2fa/enable', enable2FAValidation, enable2FA);
router.post('/2fa/disable', disable2FA);
router.get('/activity', getActivityLogs);
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);

export default router;
