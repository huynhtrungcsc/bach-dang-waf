import { queryOptions } from '@tanstack/react-query';
import { replicaNodeService } from '@/services/replica.service';

export const replicaQueryOptions = {
  all: queryOptions({
    queryKey: ['replica-nodes', 'list'],
    queryFn: () => replicaNodeService.getAll(),
    staleTime: 30 * 1000, // 30 seconds
  }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ['replica-nodes', 'detail', id],
      queryFn: () => replicaNodeService.getById(id),
      staleTime: 30 * 1000,
    }),

  status: (id: string) =>
    queryOptions({
      queryKey: ['replica-nodes', 'status', id],
      queryFn: () => replicaNodeService.getStatus(id),
      staleTime: 10 * 1000, // 10 seconds
    }),

  syncHistory: (id: string, limit: number = 50) =>
    queryOptions({
      queryKey: ['replica-nodes', 'sync-history', id, limit],
      queryFn: () => replicaNodeService.getSyncHistory(id, limit),
      staleTime: 30 * 1000,
    }),
};
