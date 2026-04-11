
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { DashboardService } from './dashboard.service';
import { GetMetricsQueryDto, GetRecentAlertsQueryDto } from './dto';
import { dashboardAnalyticsService } from './services/dashboard-analytics.service';

const dashboardService = new DashboardService();
export const getDashboardStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const stats = await dashboardService.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics',
    });
  }
};
export const getSystemMetrics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { period = '24h' } = req.query as GetMetricsQueryDto;

    const metrics = await dashboardService.getSystemMetrics(period);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Get system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system metrics',
    });
  }
};
export const getRecentAlerts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit = 5 } = req.query as GetRecentAlertsQueryDto;

    const alerts = await dashboardService.getRecentAlerts(Number(limit));

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    logger.error('Get recent alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent alerts',
    });
  }
};
export const getRequestTrend = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { interval = 5 } = req.query;
    const intervalSeconds = Math.max(5, Math.min(60, Number(interval)));

    const trend = await dashboardAnalyticsService.getRequestTrend(intervalSeconds);

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    logger.error('Get request trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get request trend',
    });
  }
};
export const getSlowRequests = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit = 10 } = req.query;
    const slowRequests = await dashboardAnalyticsService.getSlowRequests(Number(limit));

    res.json({
      success: true,
      data: slowRequests,
    });
  } catch (error) {
    logger.error('Get slow requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get slow requests',
    });
  }
};
export const getLatestAttackStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit = 5, hours = 24 } = req.query;
    const attacks = await dashboardAnalyticsService.getLatestAttacks(Number(limit), Number(hours));

    res.json({
      success: true,
      data: attacks,
    });
  } catch (error) {
    logger.error('Get latest attack stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest attack statistics',
    });
  }
};
export const getLatestNews = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { limit = 20, hours = 24 } = req.query;
    const news = await dashboardAnalyticsService.getLatestNews(Number(limit), Number(hours));

    res.json({
      success: true,
      data: news,
    });
  } catch (error) {
    logger.error('Get latest news error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest news',
    });
  }
};
export const getRequestAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { period = 'day' } = req.query;
    const validPeriod = ['day', 'week', 'month'].includes(period as string) 
      ? (period as 'day' | 'week' | 'month') 
      : 'day';

    const analytics = await dashboardAnalyticsService.getRequestAnalytics(validPeriod);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Get request analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get request analytics',
    });
  }
};
export const getAttackRatio = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const ratio = await dashboardAnalyticsService.getAttackRatio();

    res.json({
      success: true,
      data: ratio,
    });
  } catch (error) {
    logger.error('Get attack ratio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attack ratio',
    });
  }
};
export const getGeoStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const mode = (req.query.mode === 'blocked' ? 'blocked' : 'requests') as 'requests' | 'blocked';
    const data = await dashboardAnalyticsService.getGeoStats(mode);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Get geo stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get geo stats' });
  }
};

export const getDashboardAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const [
      requestTrend,
      slowRequests,
      latestAttacks,
      latestNews,
      requestAnalytics,
      attackRatio,
    ] = await Promise.all([
      dashboardAnalyticsService.getRequestTrend(5),
      dashboardAnalyticsService.getSlowRequests(10),
      dashboardAnalyticsService.getLatestAttacks(5),
      dashboardAnalyticsService.getLatestNews(20),
      dashboardAnalyticsService.getRequestAnalytics('day'),
      dashboardAnalyticsService.getAttackRatio(),
    ]);

    res.json({
      success: true,
      data: {
        requestTrend,
        slowRequests,
        latestAttacks,
        latestNews,
        requestAnalytics,
        attackRatio,
      },
    });
  } catch (error) {
    logger.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard analytics',
    });
  }
};
