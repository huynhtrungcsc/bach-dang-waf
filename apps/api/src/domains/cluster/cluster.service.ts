import crypto from 'crypto';
import logger from '../../utils/logger';
import { ClusterRepository } from './cluster.repository';
import {
  ReplicaNode,
  ReplicaNodeResponse,
  ReplicaCreationResponse,
  HealthCheckData
} from './cluster.types';
import { RegisterReplicaDto, UpdateReplicaDto } from './dto';
export class ClusterService {
  private repository: ClusterRepository;

  constructor() {
    this.repository = new ClusterRepository();
  }
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  async registerReplicaNode(
    dto: RegisterReplicaDto,
    userId?: string
  ): Promise<ReplicaCreationResponse> {
    const { name, host, port = 3001, syncInterval = 60 } = dto;

    // Check if name already exists
    const existing = await this.repository.getByName(name);

    if (existing) {
      throw new Error('Replica node with this name already exists');
    }

    // Generate API key for replica authentication
    const apiKey = this.generateApiKey();

    const node = await this.repository.insert({
      name,
      host,
      port,
      syncInterval,
      apiKey,
      syncEnabled: true,
      status: 'offline'
    });

    logger.info(`Replica node registered: ${name}`, {
      userId,
      host,
      port
    });

    return {
      id: node.id,
      name: node.name,
      host: node.host,
      port: node.port,
      apiKey: node.apiKey, // Return API key ONLY on creation
      status: node.status as 'online' | 'offline' | 'error'
    };
  }
  async getAllSlaveNodes(): Promise<ReplicaNodeResponse[]> {
    return this.repository.listAll();
  }
  async getReplicaNodeById(id: string): Promise<ReplicaNodeResponse> {
    const node = await this.repository.getById(id);

    if (!node) {
      throw new Error('Replica node not found');
    }

    return node;
  }
  async updateReplicaNode(
    id: string,
    dto: UpdateReplicaDto,
    userId?: string
  ): Promise<ReplicaNodeResponse> {
    const node = await this.repository.getById(id);

    if (!node) {
      throw new Error('Replica node not found');
    }

    // If name is being changed, check it doesn't conflict
    if (dto.name && dto.name !== node.name) {
      const existing = await this.repository.getByName(dto.name);
      if (existing) {
        throw new Error('A replica node with this name already exists');
      }
    }

    const updates: Partial<UpdateReplicaDto> = {};
    if (dto.name !== undefined)         updates.name = dto.name;
    if (dto.host !== undefined)         updates.host = dto.host;
    if (dto.port !== undefined)         updates.port = dto.port;
    if (dto.syncInterval !== undefined) updates.syncInterval = dto.syncInterval;
    if (dto.syncEnabled !== undefined)  updates.syncEnabled = dto.syncEnabled;

    const updated = await this.repository.patch(id, updates);

    logger.info(`Replica node updated: ${updated.name} (${id})`, { userId, changes: updates });

    return updated;
  }
  async deleteReplicaNode(id: string, userId?: string): Promise<void> {
    await this.repository.remove(id);

    logger.info(`Replica node deleted: ${id}`, {
      userId
    });
  }
  async healthCheck(slaveNodeId?: string, slaveNodeName?: string): Promise<HealthCheckData> {
    return {
      timestamp: new Date().toISOString(),
      nodeId: slaveNodeId,
      nodeName: slaveNodeName
    };
  }
}

// Singleton instance
export const clusterService = new ClusterService();
