import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { sslService } from '@/services/ssl.service';
import { createQueryKeys } from '@/lib/query-client';
import type {
  IssueAutoSSLRequest,
  UploadManualSSLRequest,
  UpdateSSLRequest,
} from '@/services/ssl.service';
import type { SSLCertificate } from '@/types';

// Create query keys for SSL operations
export const sslQueryKeys = createQueryKeys('ssl');

// Query options for SSL certificates
export const sslQueryOptions = {
  // Get all SSL certificates
  all: {
    queryKey: sslQueryKeys.lists(),
    queryFn: sslService.getAll,
  },
  
  // Get SSL certificate by ID
  byId: (id: string) => ({
    queryKey: sslQueryKeys.detail(id),
    queryFn: () => sslService.getById(id),
  }),
};

// Mutation options for SSL certificates
export const sslMutationOptions = {
  // Issue Let's Encrypt certificate (auto)
  issueAuto: {
    mutationFn: (data: IssueAutoSSLRequest) => sslService.issueAuto(data),
    onSuccess: async (_data: SSLCertificate) => {
      console.log('SSL certificate issued successfully');
    },
    onError: (error: any) => {
      console.error('SSL certificate issuance failed:', error);
    },
  },
  
  // Upload manual SSL certificate
  uploadManual: {
    mutationFn: (data: UploadManualSSLRequest) => sslService.uploadManual(data),
    onSuccess: async (_data: SSLCertificate) => {
      console.log('SSL certificate uploaded successfully');
    },
    onError: (error: any) => {
      console.error('SSL certificate upload failed:', error);
    },
  },
  
  // Update SSL certificate
  update: {
    mutationFn: ({ id, data }: { id: string; data: UpdateSSLRequest }) => 
      sslService.update(id, data),
    onSuccess: async (_data: SSLCertificate) => {
      console.log('SSL certificate updated successfully');
    },
    onError: (error: any) => {
      console.error('SSL certificate update failed:', error);
    },
  },
  
  // Delete SSL certificate
  delete: {
    mutationFn: (id: string) => sslService.delete(id),
    onSuccess: async () => {
      console.log('SSL certificate deleted successfully');
    },
    onError: (error: any) => {
      console.error('SSL certificate deletion failed:', error);
    },
  },
  
  // Renew SSL certificate
  renew: {
    mutationFn: (id: string) => sslService.renew(id),
    onSuccess: async (_data: SSLCertificate) => {
      console.log('SSL certificate renewed successfully');
    },
    onError: (error: any) => {
      console.error('SSL certificate renewal failed:', error);
    },
  },
};

// Custom hooks for SSL operations
export const useSSLCertificates = () => {
  return useQuery(sslQueryOptions.all);
};

export const useSSLCertificate = (id: string) => {
  return useQuery(sslQueryOptions.byId(id));
};

export const useIssueAutoSSL = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...sslMutationOptions.issueAuto,
    onSuccess: async (_data: SSLCertificate) => {
      sslMutationOptions.issueAuto.onSuccess?.(_data);
      // Invalidate SSL certificates list to refresh
      await queryClient.invalidateQueries({ queryKey: sslQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: sslQueryKeys.all });
    },
  });
};

export const useUploadManualSSL = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...sslMutationOptions.uploadManual,
    onSuccess: async (_data: SSLCertificate) => {
      sslMutationOptions.uploadManual.onSuccess?.(_data);
      // Invalidate SSL certificates list to refresh
      await queryClient.invalidateQueries({ queryKey: sslQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: sslQueryKeys.all });
    },
  });
};

export const useUpdateSSLCertificate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...sslMutationOptions.update,
    onSuccess: async (data: SSLCertificate, { id }) => {
      sslMutationOptions.update.onSuccess?.(data);
      // Update the specific SSL certificate in cache
      queryClient.setQueryData(sslQueryKeys.detail(id), data);
      // Invalidate SSL certificates list to refresh
      await queryClient.invalidateQueries({ queryKey: sslQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: sslQueryKeys.all });
    },
  });
};

export const useDeleteSSLCertificate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...sslMutationOptions.delete,
    onSuccess: async (_, id) => {
      sslMutationOptions.delete.onSuccess?.();
      // Remove the specific SSL certificate from cache
      queryClient.removeQueries({ queryKey: sslQueryKeys.detail(id) });
      // Invalidate SSL certificates list to refresh
      await queryClient.invalidateQueries({ queryKey: sslQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: sslQueryKeys.all });
    },
  });
};

export const useRenewSSLCertificate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...sslMutationOptions.renew,
    onSuccess: async (data: SSLCertificate, id) => {
      sslMutationOptions.renew.onSuccess?.(data);
      // Update the specific SSL certificate in cache
      queryClient.setQueryData(sslQueryKeys.detail(id), data);
      // Invalidate SSL certificates list to refresh
      await queryClient.invalidateQueries({ queryKey: sslQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: sslQueryKeys.all });
    },
  });
};

// Hook to preload SSL certificates data
export const usePreloadSSLCertificates = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.prefetchQuery(sslQueryOptions.all);
  };
};

// Hook to ensure SSL certificates data is loaded (useful for route loaders)
export const useEnsureSSLCertificates = () => {
  const queryClient = useQueryClient();
  
  return () => {
    return queryClient.ensureQueryData(sslQueryOptions.all);
  };
};

// Suspense query hooks for SSL operations
export const useSuspenseSSLCertificates = () => {
  return useSuspenseQuery(sslQueryOptions.all);
};

export const useSuspenseSSLCertificate = (id: string) => {
  return useSuspenseQuery(sslQueryOptions.byId(id));
};