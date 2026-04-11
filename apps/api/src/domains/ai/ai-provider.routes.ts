import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  handleListProviders,
  handleGetPresets,
  handleCreateProvider,
  handleUpdateProvider,
  handleDeleteProvider,
  handleTestProvider,
} from './ai-provider.controller';

const router = Router();

router.use(authenticate);

// Presets — any authenticated user can read
router.get('/presets', handleGetPresets);

// Test connection — admin only
router.post('/test', authorize('admin'), handleTestProvider);

// Provider CRUD — admin only
router.get('/', authorize('admin'), handleListProviders);
router.post('/', authorize('admin'), handleCreateProvider);
router.patch('/:id', authorize('admin'), handleUpdateProvider);
router.delete('/:id', authorize('admin'), handleDeleteProvider);

export default router;
