import { useState } from 'react';
import { Edit, Trash2, Globe, Shield, ShieldCheck, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteAccessList, useToggleAccessList } from '@/queries/access-lists.query-options';
import { AccessListFormDialog } from './AccessListFormDialog';
import type { AccessList } from '@/services/access-lists.service';
import { toast } from 'sonner';

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  ip_whitelist:    { label: 'IP Source Allowlist',  icon: <Shield       className="h-3 w-3" /> },
  http_basic_auth: { label: 'HTTP Basic Auth',       icon: <ShieldCheck  className="h-3 w-3" /> },
  combined:        { label: 'IP + Basic Auth',       icon: <Layers       className="h-3 w-3" /> },
};

interface AccessListCardProps {
  accessList: AccessList;
}

export function AccessListCard({ accessList }: AccessListCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteMutation = useDeleteAccessList();
  const toggleMutation = useToggleAccessList();

  const meta = TYPE_META[accessList.type] ?? { label: accessList.type, icon: <Shield className="h-3 w-3" /> };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(accessList.id);
      toast.success('Access policy deleted');
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error('Delete failed', { description: error.response?.data?.message || 'Failed to delete policy' });
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: accessList.id, enabled });
      toast.success(enabled ? 'Policy activated' : 'Policy deactivated');
    } catch (error: any) {
      toast.error('Toggle failed', { description: error.response?.data?.message || 'Failed to update policy' });
    }
  };

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {/* ── Card header ── */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-slate-800">{accessList.name}</span>
              <Badge
                variant={accessList.enabled ? 'default' : 'secondary'}
                className="text-[11px] font-medium h-5"
              >
                {accessList.enabled ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="text-[11px] font-medium h-5 flex items-center gap-1">
                {meta.icon}
                {meta.label}
              </Badge>
            </div>
            {accessList.description && (
              <p className="text-[12px] text-slate-400 mt-0.5">{accessList.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            <Switch
              checked={accessList.enabled}
              onCheckedChange={handleToggle}
              disabled={toggleMutation.isPending}
            />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="h-3.5 w-3.5 text-slate-500" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-red-600" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 text-slate-500" />
            </Button>
          </div>
        </div>

        {/* ── Card body ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100 px-4 py-3">

          {/* Source CIDRs */}
          {(accessList.type === 'ip_whitelist' || accessList.type === 'combined') && (
            <div className="md:pr-4 pb-3 md:pb-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Source CIDRs</p>
              <div className="flex flex-wrap gap-1">
                {accessList.allowedIps && accessList.allowedIps.length > 0 ? (
                  <>
                    {accessList.allowedIps.slice(0, 4).map((ip, i) => (
                      <Badge key={i} variant="secondary" className="text-[11px] font-mono">{ip}</Badge>
                    ))}
                    {accessList.allowedIps.length > 4 && (
                      <Badge variant="secondary" className="text-[11px]">+{accessList.allowedIps.length - 4} more</Badge>
                    )}
                  </>
                ) : (
                  <span className="text-[12px] text-slate-400">No CIDRs configured</span>
                )}
              </div>
            </div>
          )}

          {/* Basic Auth Users */}
          {(accessList.type === 'http_basic_auth' || accessList.type === 'combined') && (
            <div className="md:px-4 py-3 md:py-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Basic Auth Users</p>
              <div className="flex flex-wrap gap-1">
                {accessList.authUsers && accessList.authUsers.length > 0 ? (
                  <>
                    {accessList.authUsers.slice(0, 4).map((user) => (
                      <Badge key={user.id} variant="secondary" className="text-[11px] font-mono">{user.username}</Badge>
                    ))}
                    {accessList.authUsers.length > 4 && (
                      <Badge variant="secondary" className="text-[11px]">+{accessList.authUsers.length - 4} more</Badge>
                    )}
                  </>
                ) : (
                  <span className="text-[12px] text-slate-400">No credentials configured</span>
                )}
              </div>
            </div>
          )}

          {/* Bound Domains */}
          <div className={
            accessList.type === 'combined'
              ? 'md:pl-4 pt-3 md:pt-0'
              : accessList.type === 'ip_whitelist' || accessList.type === 'http_basic_auth'
                ? 'md:px-4'
                : ''
          }>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Bound Domains
            </p>
            <div className="flex flex-wrap gap-1">
              {accessList.domains && accessList.domains.length > 0 ? (
                <>
                  {accessList.domains.slice(0, 4).map((dl) => (
                    <Badge key={dl.id} variant="outline" className="text-[11px]">{dl.domain.name}</Badge>
                  ))}
                  {accessList.domains.length > 4 && (
                    <Badge variant="outline" className="text-[11px]">+{accessList.domains.length - 4} more</Badge>
                  )}
                </>
              ) : (
                <span className="text-[12px] text-slate-400">No domains bound</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <AccessListFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        accessList={accessList}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Access Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{accessList.name}"</strong>? Domains currently using this policy will lose their access restrictions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Policy'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
