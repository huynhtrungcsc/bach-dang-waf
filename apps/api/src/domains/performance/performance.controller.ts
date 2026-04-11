

import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import * as performanceService from './performance.service';
export const getPerformanceMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { domain = 'all', timeRange = '1h' } = req.query;

    const metrics = await performanceService.getMetrics(domain as string, timeRange as string);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const getPerformanceStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { domain = 'all', timeRange = '1h' } = req.query;

    const stats = await performanceService.getStats(domain as string, timeRange as string);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const getPerformanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { domain = 'all', limit = '100' } = req.query;

    const metrics = await performanceService.getHistory(domain as string, parseInt(limit as string));

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Get performance history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const cleanupOldMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days = '7' } = req.query;

    const result = await performanceService.cleanup(parseInt(days as string));

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old metrics`,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    logger.error('Cleanup old metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
