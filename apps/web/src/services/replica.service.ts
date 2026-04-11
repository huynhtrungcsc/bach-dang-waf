import api from './api';
import { ReplicaNode } from '@/types';

export interface RegisterReplicaRequest {
  name: string;
  host: string;
  port?: number;
  syncInterval?: number;
}

export interface UpdateReplicaRequest {
  name?: string;
  host?: string;
  port?: number;
  syncEnabled?: boolean;
  syncInterval?: number;
}

export interface SyncConfigRequest {
  force?: boolean;
}

export interface SyncLog {
  id: string;
  nodeId: string;
  type: 'full_sync' | 'incremental_sync' | 'health_check';
  status: 'success' | 'failed' | 'partial' | 'running';
  configHash?: string;
  changesCount?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface ReplicaNodeWithLogs extends ReplicaNode {
  syncLogs?: SyncLog[];
}

class ReplicaNodeService {
  async getAll(): Promise<ReplicaNode[]> {
    const response = await api.get('/replica/nodes');
    return response.data.data;
  }

  async getById(id: string): Promise<ReplicaNodeWithLogs> {
    const response = await api.get(`/replica/nodes/${id}`);
    return response.data.data;
  }

  async register(data: RegisterReplicaRequest) {
    console.log('SlaveNodeService.register called with:', data);

    try {
      const response = await api.post('/replica/nodes', data);
      console.log('Register response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Register error:', error.response?.data || error.message);
      throw error;
    }
  }

  async update(id: string, data: UpdateReplicaRequest) {
    const response = await api.put(`/replica/nodes/${id}`, data);
    return response.data;
  }

  async delete(id: string) {
    const response = await api.delete(`/replica/nodes/${id}`);
    return response.data;
  }

  async syncToNode(id: string, data: SyncConfigRequest = {}) {
    const response = await api.post(`/replica/nodes/${id}/sync`, data);
    return response.data;
  }

  async syncToAll() {
    const response = await api.post('/replica/nodes/sync-all', {});
    return response.data;
  }

  async getStatus(id: string) {
    const response = await api.get(`/replica/nodes/${id}/status`);
    return response.data;
  }

  async getSyncHistory(id: string, limit: number = 50) {
    const response = await api.get(`/replica/nodes/${id}/sync-history`, {
      params: { limit },
    });
    return response.data.data;
  }

  async regenerateApiKey(id: string) {
    const response = await api.post(`/replica/nodes/${id}/regenerate-key`, {});
    return response.data;
  }
}

export const replicaNodeService = new ReplicaNodeService();
