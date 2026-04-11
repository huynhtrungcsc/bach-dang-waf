import { Router } from 'express';
import { aclController } from './acl.controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.get('/', (req, res) => aclController.fetchRules(req, res));
router.get('/:id', (req, res) => aclController.fetchRule(req, res));
router.post('/', authorize('admin', 'moderator'), (req, res) => aclController.storeRule(req, res));
router.get('/preview', (req, res) => aclController.previewRules(req, res));
router.post('/import', authorize('admin', 'moderator'), (req, res) => aclController.importRules(req, res));
router.post('/apply', authorize('admin', 'moderator'), (req, res) => aclController.applyRules(req, res));
router.put('/:id', authorize('admin', 'moderator'), (req, res) => aclController.modifyRule(req, res));
router.delete('/:id', authorize('admin', 'moderator'), (req, res) => aclController.destroyRule(req, res));
router.patch('/:id/toggle', authorize('admin', 'moderator'), (req, res) => aclController.flipRule(req, res));

export default router;
