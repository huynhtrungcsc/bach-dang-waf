import * as http from 'http';
import * as https from 'https';
import logger from '../../../utils/logger';
import { DomainWithRelations } from '../domains.types';

const DEFAULT_TIMEOUT_MS = 5000;
export class UpstreamHealthService {
  async checkUpstreamsHealth(domain: DomainWithRelations): Promise<void> {
    const healthCheckPath = domain.loadBalancer?.healthCheckPath || '/';
    const timeout = domain.loadBalancer?.healthCheckTimeout
      ? domain.loadBalancer.healthCheckTimeout * 1000
      : DEFAULT_TIMEOUT_MS;

    if (!domain.upstreams || domain.upstreams.length === 0) {
      logger.info(`No upstreams to health check for domain: ${domain.name}`);
      return;
    }

    const results = await Promise.allSettled(
      domain.upstreams.map(upstream =>
        this.checkUpstreamHealth(upstream.host, upstream.port, upstream.protocol || 'http', healthCheckPath, timeout)
      )
    );

    results.forEach((result, i) => {
      const upstream = domain.upstreams[i];
      if (result.status === 'fulfilled') {
        if (result.value) {
          logger.info(`Health check OK: ${upstream.protocol}://${upstream.host}:${upstream.port}${healthCheckPath}`);
        } else {
          logger.warn(`Health check FAILED: ${upstream.protocol}://${upstream.host}:${upstream.port}${healthCheckPath}`);
        }
      } else {
        logger.error(`Health check ERROR: ${upstream.protocol}://${upstream.host}:${upstream.port}${healthCheckPath} — ${result.reason}`);
      }
    });
  }
  async checkUpstreamHealth(
    host: string,
    port: number,
    protocol: string,
    healthCheckPath: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<boolean> {
    return new Promise(resolve => {
      const isHttps = protocol === 'https';
      const lib = isHttps ? https : http;
      const url = `${protocol}://${host}:${port}${healthCheckPath}`;

      const options: http.RequestOptions = {
        hostname: host,
        port,
        path: healthCheckPath,
        method: 'GET',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'BACH-DANG-WAF/HealthCheck' },
        ...(isHttps && { rejectUnauthorized: false }),
      };

      const req = lib.request(options, res => {
        // Drain the response to free the socket
        res.resume();
        const healthy = (res.statusCode ?? 500) < 500;
        logger.debug(`Health probe ${url} → HTTP ${res.statusCode} (${healthy ? 'healthy' : 'unhealthy'})`);
        resolve(healthy);
      });

      req.on('timeout', () => {
        req.destroy();
        logger.warn(`Health probe timeout: ${url}`);
        resolve(false);
      });

      req.on('error', err => {
        logger.warn(`Health probe error: ${url} — ${err.message}`);
        resolve(false);
      });

      req.end();
    });
  }
}

export const upstreamHealthService = new UpstreamHealthService();
