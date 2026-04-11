import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { getLogs, getLogStatistics, downloadLogs, getAvailableDomains } from './logs.controller';

const router = Router();
router.get('/', authenticate, getLogs);
router.get('/stats', authenticate, getLogStatistics);
router.get('/domains', authenticate, getAvailableDomains);
router.get('/download', authenticate, downloadLogs);

export default router;
