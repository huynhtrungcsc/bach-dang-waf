
import os from 'os';
import logger from '../../utils/logger';
import { dashboardRepository } from './dashboard.repository';
import { dashboardStatsService } from './services/dashboard-stats.service';
import {
  DashboardStats,
  SystemMetrics,
  MetricPeriod,
} from './dashboard.types';

export class DashboardService {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get domain and alert statistics from repository
      const [domains, alerts, trafficStats, cpuUsage, diskUsage] = await Promise.all([
        dashboardRepository.getDomainStats(),
        dashboardRepository.getAlertStats(),
        dashboardStatsService.getTrafficStats(),
        dashboardStatsService.getCurrentCPUUsage(),
        dashboardStatsService.getDiskUsage(),
      ]);

      const memoryUsage = dashboardStatsService.getCurrentMemoryUsage();
      const uptime = dashboardStatsService.calculateUptimePercentage();
      const cpuCores = dashboardStatsService.getCPUCoreCount();

      const uptimeSec = os.uptime();
      const uptimeDays = Math.floor(uptimeSec / 86400);
      const uptimeHrs  = Math.floor((uptimeSec % 86400) / 3600);
      const uptimeMins = Math.floor((uptimeSec % 3600) / 60);
      const uptimeDuration = `${uptimeDays}d ${uptimeHrs}h ${uptimeMins}m`;

      return {
        domains,
        alerts,
        traffic: trafficStats,
        uptime,
        uptimeDuration,
        system: {
          cpuUsage: parseFloat(cpuUsage.toFixed(2)),
          memoryUsage: parseFloat(memoryUsage.toFixed(2)),
          diskUsage: parseFloat(diskUsage.toFixed(1)),
          cpuCores,
        },
      };
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      throw error;
    }
  }
  async getSystemMetrics(period: MetricPeriod = '24h'): Promise<SystemMetrics> {
    try {
      // Generate time-series data based on period
      const dataPoints = period === '24h' ? 24 : period === '7d' ? 168 : 30;
      const interval = period === '24h' ? 3600000 : period === '7d' ? 3600000 : 86400000;

      const [cpu, memory, bandwidth, requests] = await Promise.all([
        dashboardStatsService.generateCPUMetrics(dataPoints, interval),
        dashboardStatsService.generateMemoryMetrics(dataPoints, interval),
        dashboardStatsService.generateBandwidthMetrics(dataPoints, interval),
        dashboardStatsService.generateRequestMetrics(dataPoints, interval),
      ]);

      return {
        cpu,
        memory,
        bandwidth,
        requests,
      };
    } catch (error) {
      logger.error('Get system metrics error:', error);
      throw error;
    }
  }
  async getRecentAlerts(limit: number = 5): Promise<any[]> {
    try {
      return await dashboardRepository.getRecentAlerts(limit);
    } catch (error) {
      logger.error('Get recent alerts error:', error);
      throw error;
    }
  }

}
