import { Router, type IRouter } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  listSchedules,
  findSchedule,
  addSchedule,
  editSchedule,
  removeSchedule,
  switchSchedule,
  runNow,
  exportBackup,
  importBackup,
  listBackupFiles,
  downloadBackup,
  removeBackupFile,
} from './backup.controller';

const router: IRouter = Router();

// All routes require authentication
router.use(authenticate);
router.get('/schedules', listSchedules);
router.get('/schedules/:id', findSchedule);
router.post('/schedules', authorize('admin', 'moderator'), addSchedule);
router.put('/schedules/:id', authorize('admin', 'moderator'), editSchedule);
router.delete('/schedules/:id', authorize('admin', 'moderator'), removeSchedule);
router.patch('/schedules/:id/toggle', authorize('admin', 'moderator'), switchSchedule);
router.post('/schedules/:id/run', authorize('admin', 'moderator'), runNow);
router.get('/export', authorize('admin', 'moderator'), exportBackup);
router.post('/import', authorize('admin'), importBackup);
router.get('/files', listBackupFiles);
router.get('/files/:id/download', authorize('admin', 'moderator'), downloadBackup);
router.delete('/files/:id', authorize('admin'), removeBackupFile);

export default router;
