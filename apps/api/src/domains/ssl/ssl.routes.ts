import express from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../../middleware/auth';
import {
  getSSLCertificates,
  getSSLCertificate,
  getSSLSystemInfo,
  issueAutoSSL,
  uploadManualSSL,
  updateSSLCertificate,
  deleteSSLCertificate,
  renewSSLCertificate,
} from './ssl.controller';

const router = express.Router();

// All SSL routes require authentication
router.use(authenticate);
router.get('/system-info', getSSLSystemInfo);
router.get('/', getSSLCertificates);
router.get('/:id', getSSLCertificate);
router.post(
  '/auto',
  authorize('admin', 'moderator'),
  [
    body('domainId').notEmpty().withMessage('Domain ID is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('autoRenew').optional().isBoolean().withMessage('Auto renew must be boolean'),
  ],
  issueAutoSSL
);
router.post(
  '/manual',
  authorize('admin', 'moderator'),
  [
    body('domainId').notEmpty().withMessage('Domain ID is required'),
    body('certificate').notEmpty().withMessage('Certificate is required'),
    body('privateKey').notEmpty().withMessage('Private key is required'),
    body('chain').optional().isString(),
    body('issuer').optional().isString(),
  ],
  uploadManualSSL
);
router.put(
  '/:id',
  authorize('admin', 'moderator'),
  [
    body('certificate').optional().isString(),
    body('privateKey').optional().isString(),
    body('chain').optional().isString(),
    body('autoRenew').optional().isBoolean(),
  ],
  updateSSLCertificate
);
router.delete('/:id', authorize('admin', 'moderator'), deleteSSLCertificate);
router.post('/:id/renew', authorize('admin', 'moderator'), renewSSLCertificate);

export default router;
