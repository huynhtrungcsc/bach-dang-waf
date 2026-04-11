import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCRSRules,
  toggleCRSRule,
  getModSecRules,
  getModSecRule,
  toggleModSecRule,
  addCustomRule,
  updateModSecRule,
  deleteModSecRule,
  getGlobalModSecSettings,
  setGlobalModSec,
} from '@/services/modsec.service';
import { createQueryKeys } from '@/lib/query-client';
import type {
  CreateModSecRuleRequest,
  UpdateModSecRuleRequest,
} from '@/services/modsec.service';
import type { ModSecurityCRSRule, ModSecurityCustomRule } from '@/types';

// Create query keys for ModSecurity operations
export const modsecQueryKeys = createQueryKeys('modsec');

// Query options for ModSecurity
export const modsecQueryOptions = {
  // Get CRS rules
  crsRules: (domainId?: string) => ({
    queryKey: modsecQueryKeys.list({ type: 'crs', domainId }),
    queryFn: () => getCRSRules(domainId),
  }),
  
  // Get custom ModSecurity rules
  customRules: (domainId?: string) => ({
    queryKey: modsecQueryKeys.list({ type: 'custom', domainId }),
    queryFn: () => getModSecRules(domainId),
  }),
  
  // Get ModSecurity rule by ID
  customRule: (id: string) => ({
    queryKey: modsecQueryKeys.detail(id),
    queryFn: () => getModSecRule(id),
  }),
  
  // Get global ModSecurity settings
  globalSettings: {
    queryKey: modsecQueryKeys.detail('global-settings'),
    queryFn: getGlobalModSecSettings,
  },
};

// Mutation options for ModSecurity
export const modsecMutationOptions = {
  // Toggle CRS rule
  toggleCRSRule: {
    mutationFn: ({ ruleFile, domainId }: { ruleFile: string; domainId?: string }) => 
      toggleCRSRule(ruleFile, domainId),
    onSuccess: (_data: ModSecurityCRSRule) => {
      console.log('CRS rule toggled successfully');
    },
    onError: (error: any) => {
      console.error('CRS rule toggle failed:', error);
    },
  },
  
  // Toggle custom ModSecurity rule
  toggleCustomRule: {
    mutationFn: (id: string) => toggleModSecRule(id),
    onSuccess: (_data: ModSecurityCustomRule) => {
      console.log('ModSecurity rule toggled successfully');
    },
    onError: (error: any) => {
      console.error('ModSecurity rule toggle failed:', error);
    },
  },
  
  // Add custom ModSecurity rule
  addCustomRule: {
    mutationFn: (data: CreateModSecRuleRequest) => addCustomRule(data),
    onSuccess: (_data: ModSecurityCustomRule) => {
      console.log('ModSecurity rule created successfully');
    },
    onError: (error: any) => {
      console.error('ModSecurity rule creation failed:', error);
    },
  },
  
  // Update ModSecurity rule
  updateCustomRule: {
    mutationFn: ({ id, data }: { id: string; data: UpdateModSecRuleRequest }) => 
      updateModSecRule(id, data),
    onSuccess: (_data: ModSecurityCustomRule) => {
      console.log('ModSecurity rule updated successfully');
    },
    onError: (error: any) => {
      console.error('ModSecurity rule update failed:', error);
    },
  },
  
  // Delete ModSecurity rule
  deleteCustomRule: {
    mutationFn: (id: string) => deleteModSecRule(id),
    onSuccess: () => {
      console.log('ModSecurity rule deleted successfully');
    },
    onError: (error: any) => {
      console.error('ModSecurity rule deletion failed:', error);
    },
  },
  
  // Set global ModSecurity enabled/disabled
  setGlobalModSec: {
    mutationFn: (enabled: boolean) => setGlobalModSec(enabled),
    onSuccess: () => {
      console.log('Global ModSecurity settings updated successfully');
    },
    onError: (error: any) => {
      console.error('Global ModSecurity settings update failed:', error);
    },
  },
};

// Custom hooks for ModSecurity operations
export const useCrsRules = (domainId?: string) => {
  return useQuery(modsecQueryOptions.crsRules(domainId));
};

export const useModSecRules = (domainId?: string) => {
  return useQuery(modsecQueryOptions.customRules(domainId));
};

export const useModSecRule = (id: string) => {
  return useQuery(modsecQueryOptions.customRule(id));
};

export const useGlobalModSecSettings = () => {
  return useQuery(modsecQueryOptions.globalSettings);
};

export const useToggleCrsRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...modsecMutationOptions.toggleCRSRule,
    onMutate: async ({ ruleFile, domainId }) => {
      const queryKey = modsecQueryKeys.list({ type: 'crs', domainId });
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ModSecurityCRSRule[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<ModSecurityCRSRule[]>(queryKey, prev =>
          (prev ?? []).map(r => r.ruleFile === ruleFile ? { ...r, enabled: !r.enabled } : r)
        );
      }
      return { previous, queryKey };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: (data: ModSecurityCRSRule, { domainId }) => {
      modsecMutationOptions.toggleCRSRule.onSuccess?.(data);
      queryClient.invalidateQueries({ queryKey: modsecQueryKeys.list({ type: 'crs', domainId }) });
    },
  });
};

export const useToggleModSecRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...modsecMutationOptions.toggleCustomRule,
    onMutate: async (id: string) => {
      const listKey = modsecQueryKeys.list({ type: 'custom' });
      const detailKey = modsecQueryKeys.detail(id);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousList = queryClient.getQueryData<ModSecurityCustomRule[]>(listKey);
      const previousDetail = queryClient.getQueryData<ModSecurityCustomRule>(detailKey);
      if (previousList) {
        queryClient.setQueryData<ModSecurityCustomRule[]>(listKey, prev =>
          (prev ?? []).map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
        );
      }
      if (previousDetail) {
        queryClient.setQueryData<ModSecurityCustomRule>(detailKey, { ...previousDetail, enabled: !previousDetail.enabled });
      }
      return { previousList, previousDetail, listKey, detailKey };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(context.listKey, context.previousList);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
    },
    onSuccess: (data: ModSecurityCustomRule, id) => {
      modsecMutationOptions.toggleCustomRule.onSuccess?.(data);
      queryClient.setQueryData(modsecQueryKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: modsecQueryKeys.list({ type: 'custom' }) });
    },
  });
};

export const useAddModSecRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...modsecMutationOptions.addCustomRule,
    onSuccess: (data: ModSecurityCustomRule) => {
      modsecMutationOptions.addCustomRule.onSuccess?.(data);
      // Invalidate custom rules list to refresh
      queryClient.invalidateQueries({ queryKey: modsecQueryKeys.list({ type: 'custom' }) });
    },
  });
};

export const useUpdateModSecRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...modsecMutationOptions.updateCustomRule,
    onSuccess: (data: ModSecurityCustomRule, { id }) => {
      modsecMutationOptions.updateCustomRule.onSuccess?.(data);
      // Update the specific rule in cache
      queryClient.setQueryData(modsecQueryKeys.detail(id), data);
      // Invalidate custom rules list to refresh
      queryClient.invalidateQueries({ queryKey: modsecQueryKeys.list({ type: 'custom' }) });
    },
  });
};

export const useDeleteModSecRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...modsecMutationOptions.deleteCustomRule,
    onSuccess: (_, id) => {
      modsecMutationOptions.deleteCustomRule.onSuccess?.();
      // Remove the specific rule from cache
      queryClient.removeQueries({ queryKey: modsecQueryKeys.detail(id) });
      // Invalidate custom rules list to refresh
      queryClient.invalidateQueries({ queryKey: modsecQueryKeys.list({ type: 'custom' }) });
    },
  });
};

export const useSetGlobalModSec = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    ...modsecMutationOptions.setGlobalModSec,
    onMutate: async (enabled: boolean) => {
      const queryKey = modsecQueryKeys.detail('global-settings');
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => old ? { ...old, enabled } : { enabled, config: null });
      return { previous, queryKey };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: () => {
      modsecMutationOptions.setGlobalModSec.onSuccess?.();
      queryClient.invalidateQueries({ queryKey: modsecQueryKeys.detail('global-settings') });
    },
  });
};

// Hooks to preload data
export const usePreloadModSecData = (domainId?: string) => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.prefetchQuery(modsecQueryOptions.crsRules(domainId));
    queryClient.prefetchQuery(modsecQueryOptions.customRules(domainId));
    queryClient.prefetchQuery(modsecQueryOptions.globalSettings);
  };
};

// Hooks to ensure data is loaded (useful for route loaders)
export const useEnsureModSecData = (domainId?: string) => {
  const queryClient = useQueryClient();
  
  return () => {
    return Promise.all([
      queryClient.ensureQueryData(modsecQueryOptions.crsRules(domainId)),
      queryClient.ensureQueryData(modsecQueryOptions.customRules(domainId)),
      queryClient.ensureQueryData(modsecQueryOptions.globalSettings),
    ]);
  };
};