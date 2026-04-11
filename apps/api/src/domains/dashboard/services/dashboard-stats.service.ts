

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import logger from '../../../utils/logger';
import { MetricDataPoint, TrafficStats } from '../dashboard.types';

const execAsync = promisify(exec);
export class DashboardStatsService {
  async getTrafficStats(): Promise<TrafficStats> {
    try {
      // Try to get actual traffic from nginx logs
      const { stdout } = await execAsync(
        "grep -c '' /var/log/nginx/access.log 2>/dev/null || echo 0"
      );
      const totalRequests = parseInt(stdout.trim()) || 0;

      return {
        requestsPerDay: this.formatTrafficNumber(totalRequests),
        requestsPerSecond: Math.floor(totalRequests / 86400),
      };
    } catch (error) {
      logger.warn('Failed to get traffic stats:', error);
      return {
        requestsPerDay: '0',
        requestsPerSecond: 0,
      };
    }
  }
  async generateCPUMetrics(
    dataPoints: number,
    interval: number
  ): Promise<MetricDataPoint[]> {
    const currentCPU = await this.getCurrentCPUUsage();
    return Array.from({ length: dataPoints }, (_, i) => ({
      timestamp: new Date(Date.now() - (dataPoints - 1 - i) * interval).toISOString(),
      value: parseFloat(currentCPU.toFixed(2)),
    }));
  }
  async generateMemoryMetrics(
    dataPoints: number,
    interval: number
  ): Promise<MetricDataPoint[]> {
    const currentMemory = this.getCurrentMemoryUsage();
    return Array.from({ length: dataPoints }, (_, i) => ({
      timestamp: new Date(Date.now() - (dataPoints - 1 - i) * interval).toISOString(),
      value: parseFloat(currentMemory.toFixed(2)),
    }));
  }
  async generateBandwidthMetrics(
    dataPoints: number,
    interval: number
  ): Promise<MetricDataPoint[]> {
    return Array.from({ length: dataPoints }, (_, i) => ({
      timestamp: new Date(Date.now() - (dataPoints - 1 - i) * interval).toISOString(),
      value: 0,
    }));
  }
  async generateRequestMetrics(
    dataPoints: number,
    interval: number
  ): Promise<MetricDataPoint[]> {
    try {
      const { stdout } = await execAsync(
        "grep -c '' /var/log/nginx/access.log 2>/dev/null || echo 0"
      );
      const totalRequests = parseInt(stdout.trim()) || 0;
      const perInterval = dataPoints > 0 ? Math.floor(totalRequests / dataPoints) : 0;
      return Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(Date.now() - (dataPoints - 1 - i) * interval).toISOString(),
        value: perInterval,
      }));
    } catch {
      return Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(Date.now() - (dataPoints - 1 - i) * interval).toISOString(),
        value: 0,
      }));
    }
  }
  async getCurrentCPUUsage(): Promise<number> {
    try {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - (100 * idle) / total;

      return usage;
    } catch (error) {
      logger.warn('Failed to get CPU usage:', error);
      return 0;
    }
  }
  getCurrentMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;

    return usage;
  }
  getCPUCoreCount(): number {
    return os.cpus().length;
  }
  async getDiskUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("df -k / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%'");
      const pct = parseFloat(stdout.trim());
      return isNaN(pct) ? 0 : pct;
    } catch (error) {
      logger.warn('Failed to get disk usage:', error);
      return 0;
    }
  }
  calculateUptimePercentage(): string {
    const uptimeSeconds = os.uptime();
    const uptimeDays = uptimeSeconds / (24 * 3600);
    const uptime = uptimeDays > 30 ? 99.9 : (uptimeSeconds / (30 * 24 * 3600)) * 100;
    return uptime.toFixed(1);
  }
  private formatTrafficNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}

// Export singleton instance
export const dashboardStatsService = new DashboardStatsService();
