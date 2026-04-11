import { Router, Request, Response } from 'express';
import { accessListsController } from './access-lists.controller';
import { authenticate, authorize } from '../../middleware/auth';
import {
  createAccessListValidation,
  updateAccessListValidation,
  getAccessListsValidation,
  getAccessListValidation,
  deleteAccessListValidation,
  applyToDomainValidation,
  removeFromDomainValidation,
} from './dto/access-lists.dto';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.get(
  '/',
  getAccessListsValidation,
  (req: Request, res: Response) => accessListsController.getAccessLists(req, res)
);
router.get(
  '/stats',
  (req: Request, res: Response) => accessListsController.getStats(req, res)
);
router.get(
  '/:id',
  getAccessListValidation,
  (req: Request, res: Response) => accessListsController.getAccessList(req, res)
);
router.post(
  '/',
  authorize('admin', 'moderator'),
  createAccessListValidation,
  (req: Request, res: Response) => accessListsController.createAccessList(req, res)
);
router.put(
  '/:id',
  authorize('admin', 'moderator'),
  updateAccessListValidation,
  (req: Request, res: Response) => accessListsController.updateAccessList(req, res)
);
router.delete(
  '/:id',
  authorize('admin', 'moderator'),
  deleteAccessListValidation,
  (req: Request, res: Response) => accessListsController.deleteAccessList(req, res)
);
router.patch(
  '/:id/toggle',
  authorize('admin', 'moderator'),
  (req: Request, res: Response) => accessListsController.toggleAccessList(req, res)
);
router.post(
  '/apply',
  authorize('admin', 'moderator'),
  applyToDomainValidation,
  (req: Request, res: Response) => accessListsController.applyToDomain(req, res)
);
router.delete(
  '/:accessListId/domains/:domainId',
  authorize('admin', 'moderator'),
  removeFromDomainValidation,
  (req: Request, res: Response) => accessListsController.removeFromDomain(req, res)
);
router.get(
  '/domains/:domainId',
  (req: Request, res: Response) => accessListsController.getByDomain(req, res)
);

export default router;
