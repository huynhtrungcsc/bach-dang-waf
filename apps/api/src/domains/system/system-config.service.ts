import axios from 'axios';
import logger from '../../utils/logger';
import { SystemConfigRepository } from './system-config.repository';
import { SystemConfig, NodeMode } from './system.types';
import { RequestException, NotFoundException } from '../../shared/errors/app-error';
export class SystemConfigService {
  private repository: SystemConfigRepository;

  constructor() {
    this.repository = new SystemConfigRepository();
  }
  async getSystemConfig(): Promise<SystemConfig> {
    return this.repository.getSystemConfig();
  }
  async updateNodeMode(nodeMode: string): Promise<SystemConfig> {
    if (!['master', 'slave'].includes(nodeMode)) {
      throw new RequestException('Invalid node mode. Must be "master" or "slave"');
    }

    let config = await this.repository.getSystemConfig();

    if (!config) {
      // Create new config if doesn't exist
      config = await this.repository.createSystemConfig(nodeMode as NodeMode);
    } else {
      // Update existing config
      const resetReplicaConnection = nodeMode === 'master';
      config = await this.repository.updateNodeMode(
        config.id,
        nodeMode as NodeMode,
        resetReplicaConnection
      );
    }

    return config;
  }
  async connectToMaster(
    masterHost: string,
    masterPort: number,
    masterApiKey: string
  ): Promise<SystemConfig> {
    if (!masterHost || !masterPort || !masterApiKey) {
      throw new RequestException('Master host, port, and API key are required');
    }

    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundException('System config not found. Please set node mode first.');
    }

    if (config.nodeMode !== 'slave') {
      throw new RequestException('Cannot connect to primary. Node mode must be "slave".');
    }

    // Test connection to master
    try {
      logger.info('Testing connection to master...', { masterHost, masterPort });

      const response = await axios.get(
        `http://${masterHost}:${masterPort}/api/replica/health`,
        {
          headers: {
            'X-API-Key': masterApiKey,
          },
          timeout: 10000,
        }
      );

      if (!response.data.success) {
        throw new Error('Master health check failed');
      }

      // Connection successful, update config
      const updatedConfig = await this.repository.updateMasterConnection(
        config.id,
        masterHost,
        masterPort,
        masterApiKey,
        true
      );

      logger.info('Successfully connected to master', {
        masterHost,
        masterPort,
      });

      return updatedConfig;
    } catch (connectionError: any) {
      // Connection failed, update config with error
      const errorMessage =
        connectionError.response?.data?.message ||
        connectionError.message ||
        'Failed to connect to master';

      const updatedConfig = await this.repository.updateMasterConnection(
        config.id,
        masterHost,
        masterPort,
        masterApiKey,
        false,
        errorMessage
      );

      logger.error('Failed to connect to master:', {
        error: errorMessage,
        masterHost,
        masterPort,
      });

      throw new RequestException(errorMessage);
    }
  }
  async disconnectFromMaster(): Promise<SystemConfig> {
    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundException('System config not found');
    }

    return this.repository.disconnectFromMaster(config.id);
  }
  async testMasterConnection(): Promise<{
    latency: number;
    masterVersion: string;
    masterStatus: string;
  }> {
    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundException('System config not found');
    }

    if (!config.masterHost || !config.masterPort || !config.masterApiKey) {
      throw new RequestException('Master connection not configured');
    }

    try {
      // Test connection
      const startTime = Date.now();
      const response = await axios.get(
        `http://${config.masterHost}:${config.masterPort}/api/replica/health`,
        {
          headers: {
            'X-API-Key': config.masterApiKey,
          },
          timeout: 10000,
        }
      );
      const latency = Date.now() - startTime;

      // Update config with successful connection
      await this.repository.updateConnectionStatus(config.id, true);

      return {
        latency,
        masterVersion: response.data.version,
        masterStatus: response.data.status,
      };
    } catch (error: any) {
      logger.error('Test master connection error:', error);

      // Update config with error
      await this.repository.updateConnectionStatus(
        config.id,
        false,
        error.message
      );

      throw new RequestException(
        error.response?.data?.message || error.message || 'Connection test failed'
      );
    }
  }
  async syncWithMaster(authToken: string): Promise<{
    imported: boolean;
    masterHash: string;
    replicaHash: string | null;
    changesApplied: number;
    details?: any;
    lastSyncAt: string;
  }> {
    logger.info('========== SYNC WITH MASTER CALLED ==========');

    const config = await this.repository.getSystemConfig();

    if (!config) {
      throw new NotFoundException('System config not found');
    }

    if (config.nodeMode !== 'slave') {
      throw new RequestException('Cannot sync. Node mode must be "slave".');
    }

    if (!config.connected || !config.masterHost || !config.masterApiKey) {
      throw new RequestException('Not connected to master. Please connect first.');
    }

    logger.info('Starting sync from master...', {
      masterHost: config.masterHost,
      masterPort: config.masterPort,
    });

    // Download config from master using new node-sync API
    const masterUrl = `http://${config.masterHost}:${config.masterPort || 3001}/api/node-sync/export`;

    const response = await axios.get(masterUrl, {
      headers: {
        'X-Replica-Api-Key': config.masterApiKey,
      },
      timeout: 30000,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to export config from master');
    }

    // Basic validation: check if response has required structure
    if (!response.data.data || !response.data.data.hash || !response.data.data.config) {
      throw new RequestException('Invalid response structure from master');
    }

    const { hash: masterHash, config: masterConfig } = response.data.data;

    // Calculate CURRENT hash of replica's config (to detect data loss)
    const replicaCurrentConfigResponse = await axios.get(
      `http://localhost:${process.env.PORT || 3001}/api/node-sync/current-hash`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const replicaCurrentHash = replicaCurrentConfigResponse.data.data?.hash || null;

    logger.info('Comparing replica current config with master', {
      masterHash,
      replicaCurrentHash,
      lastSyncHash: config.lastSyncHash || 'none',
    });

    // Compare CURRENT replica hash with master hash
    if (replicaCurrentHash && replicaCurrentHash === masterHash) {
      logger.info('Config identical (hash match), skipping import');

      // Update lastConnectedAt and lastSyncHash
      await this.repository.updateLastSyncHash(config.id, masterHash);

      return {
        imported: false,
        masterHash,
        replicaHash: replicaCurrentHash,
        changesApplied: 0,
        lastSyncAt: new Date().toISOString(),
      };
    }

    // Hash different - Force sync (data loss or master updated)
    logger.info('Config mismatch detected, force syncing...', {
      masterHash,
      replicaCurrentHash: replicaCurrentHash || 'null',
      reason: !replicaCurrentHash ? 'slave_empty' : 'data_mismatch',
    });

    // Call import API (internal call to ourselves)
    const importResponse = await axios.post(
      `http://localhost:${process.env.PORT || 3001}/api/node-sync/import`,
      {
        hash: masterHash,
        config: masterConfig,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!importResponse.data.success) {
      throw new Error(importResponse.data.message || 'Import failed');
    }

    const importData = importResponse.data.data;

    // Update lastSyncHash
    await this.repository.updateLastSyncHash(config.id, masterHash);

    logger.info(`Sync completed successfully. ${importData.changes} changes applied.`);

    return {
      imported: true,
      masterHash,
      replicaHash: replicaCurrentHash,
      changesApplied: importData.changes,
      details: importData.details,
      lastSyncAt: new Date().toISOString(),
    };
  }
}
