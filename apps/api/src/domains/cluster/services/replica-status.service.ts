import logger from '../../../utils/logger';
import { ClusterRepository } from '../cluster.repository';
export class ReplicaStatusService {
  private repository: ClusterRepository;

  constructor() {
    this.repository = new ClusterRepository();
  }
  async checkSlaveNodeStatus(): Promise<void> {
    try {
      const staleNodes = await this.repository.findStaleNodes(5);

      if (staleNodes.length > 0) {
        logger.info('[REPLICA-STATUS] Marking stale nodes as offline', {
          count: staleNodes.length,
          nodes: staleNodes.map(n => n.name)
        });

        // Update to offline
        await this.repository.markNodesOffline(staleNodes.map(n => n.id));
      }
    } catch (error: any) {
      logger.error('[REPLICA-STATUS] Check replica status error:', error);
    }
  }
}

// Singleton instance
export const replicaStatusService = new ReplicaStatusService();
export function startReplicaStatusCheck(): NodeJS.Timeout {
  logger.info('[REPLICA-STATUS] Starting replica node status checker (interval: 60s)');

  // Run immediately on start
  replicaStatusService.checkSlaveNodeStatus();

  // Then run every minute
  return setInterval(() => replicaStatusService.checkSlaveNodeStatus(), 60 * 1000);
}
export function stopReplicaStatusCheck(timer: NodeJS.Timeout): void {
  logger.info('[REPLICA-STATUS] Stopping replica node status checker');
  clearInterval(timer);
}
