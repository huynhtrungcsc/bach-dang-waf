import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../../middleware/auth';
import { validateReplicaApiKey } from './middleware/replica-auth.middleware';
import {
  registerReplicaNode,
  getReplicaNodes,
  getReplicaNode,
  deleteReplicaNode,
  healthCheck
} from './cluster.controller';

const router = Router();
router.post(
  '/nodes',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('host').notEmpty().withMessage('Host is required'),
    body('port').optional().isInt({ min: 1, max: 65535 }),
    body('syncInterval').optional().isInt({ min: 10 })
  ],
  registerReplicaNode
);
router.get('/nodes', authenticate, getReplicaNodes);
router.get('/nodes/:id', authenticate, getReplicaNode);
router.delete('/nodes/:id', authenticate, authorize('admin'), deleteReplicaNode);
router.get('/health', validateReplicaApiKey, healthCheck);

export default router;
