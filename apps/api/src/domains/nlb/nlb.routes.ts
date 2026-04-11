import { Router } from 'express';
import { nlbController } from './nlb.controller';
import { authenticate, authorize } from '../../middleware/auth';
import {
  createNLBValidation,
  updateNLBValidation,
  queryValidation,
  idValidation,
  toggleEnabledValidation,
} from './dto/nlb.dto';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.get('/', queryValidation, nlbController.getNLBs.bind(nlbController));
router.get('/stats', nlbController.getStats.bind(nlbController));
router.get('/:id', idValidation, nlbController.findNlb.bind(nlbController));
router.post(
  '/',
  authorize('admin', 'moderator'),
  createNLBValidation,
  nlbController.addNlb.bind(nlbController)
);
router.put(
  '/:id',
  authorize('admin', 'moderator'),
  idValidation,
  updateNLBValidation,
  nlbController.editNlb.bind(nlbController)
);
router.delete(
  '/:id',
  authorize('admin'),
  idValidation,
  nlbController.removeNlb.bind(nlbController)
);
router.post(
  '/:id/toggle',
  authorize('admin', 'moderator'),
  idValidation,
  toggleEnabledValidation,
  nlbController.switchNlb.bind(nlbController)
);
router.post(
  '/:id/health-check',
  authorize('admin', 'moderator'),
  idValidation,
  nlbController.checkHealth.bind(nlbController)
);

export default router;
