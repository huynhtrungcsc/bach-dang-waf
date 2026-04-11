import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { backupService } from './backup.service';
import { CreateBackupScheduleDto, UpdateBackupScheduleDto } from './dto';
export const listSchedules = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const schedules = await backupService.listSchedules();

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    logger.error('Get backup schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const findSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const schedule = await backupService.findSchedule(id);

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error: any) {
    logger.error('Get backup schedule error:', error);

    if (error.message === 'Backup schedule not found') {
      res.status(404).json({
        success: false,
        message: 'Backup schedule not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const addSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const dto: CreateBackupScheduleDto = req.body;

    const newSchedule = await backupService.addSchedule(
      dto,
      req.user?.userId
    );

    res.status(201).json({
      success: true,
      message: 'Backup schedule created successfully',
      data: newSchedule,
    });
  } catch (error) {
    logger.error('Create backup schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const editSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const dto: UpdateBackupScheduleDto = req.body;

    const updatedSchedule = await backupService.editSchedule(
      id,
      dto,
      req.user?.userId
    );

    res.json({
      success: true,
      message: 'Backup schedule updated successfully',
      data: updatedSchedule,
    });
  } catch (error) {
    logger.error('Update backup schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const removeSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    await backupService.removeSchedule(id, req.user?.userId);

    res.json({
      success: true,
      message: 'Backup schedule deleted successfully',
    });
  } catch (error) {
    logger.error('Delete backup schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const switchSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const updated = await backupService.switchSchedule(id, req.user?.userId);

    res.json({
      success: true,
      message: `Backup schedule ${updated.enabled ? 'enabled' : 'disabled'}`,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Toggle backup schedule error:', error);

    if (error.message === 'Backup schedule not found') {
      res.status(404).json({
        success: false,
        message: 'Backup schedule not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const runNow = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await backupService.runNow(id, req.user?.userId);

    res.json({
      success: true,
      message: 'Backup completed successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Run backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Backup failed',
    });
  }
};
export const exportBackup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const backupData = await backupService.exportBackup(req.user?.userId);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `nginx-config-${timestamp}.json`;

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(backupData);
  } catch (error) {
    logger.error('Export config error:', error);
    res.status(500).json({
      success: false,
      message: 'Export failed',
    });
  }
};
export const importBackup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const backupData = req.body;

    const { results, nginxReloaded } = await backupService.importBackup(
      backupData,
      req.user?.userId
    );

    res.json({
      success: true,
      message: nginxReloaded
        ? 'Configuration restored successfully and nginx reloaded'
        : 'Configuration restored successfully, but nginx reload failed. Please reload manually.',
      data: results,
      nginxReloaded,
    });
  } catch (error: any) {
    logger.error('Import config error:', error);

    if (error.message === 'Invalid backup data') {
      res.status(400).json({
        success: false,
        message: 'Invalid backup data',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Import failed',
    });
  }
};
export const listBackupFiles = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { scheduleId } = req.query;

    const backups = await backupService.listBackupFiles(scheduleId as string);

    res.json({
      success: true,
      data: backups,
    });
  } catch (error) {
    logger.error('Get backup files error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const downloadBackup = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const backup = await backupService.findBackupFile(id);

    // Check if file exists
    const fs = require('fs/promises');
    try {
      await fs.access(backup.filepath);
    } catch {
      res.status(404).json({
        success: false,
        message: 'Backup file not found on disk',
      });
      return;
    }

    // Send file
    res.download(backup.filepath, backup.filename);

    logger.info(`Backup downloaded: ${backup.filename}`, {
      userId: req.user?.userId,
    });
  } catch (error: any) {
    logger.error('Download backup error:', error);

    if (error.message === 'Backup file not found') {
      res.status(404).json({
        success: false,
        message: 'Backup file not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Download failed',
    });
  }
};
export const removeBackupFile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    await backupService.removeBackupFile(id, req.user?.userId);

    res.json({
      success: true,
      message: 'Backup file deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete backup file error:', error);

    if (error.message === 'Backup file not found') {
      res.status(404).json({
        success: false,
        message: 'Backup file not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
