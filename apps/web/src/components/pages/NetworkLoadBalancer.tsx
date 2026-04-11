import { useState } from 'react';
import { useNLBs, useNLBStats, useDeleteNLB, useToggleNLB } from '@/queries/nlb.query-options';
import { NetworkLoadBalancer as NLBType } from '@/types';
import {
  Search, Plus, Edit, Trash2, Power, PowerOff,
  Activity, Network, Server, CheckCircle2,
  MoreHorizontal, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import NLBFormDialog from '@/components/forms/NLBFormDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ─── Stat card — matches Dashboard exactly ─── */
function StatCard({ label, value, sub, icon: Icon, iconColor }: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold text-slate-800 leading-none">{value}</div>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

/* ─── Status dot ─── */
function StatusDot({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active:   { cls: 'bg-emerald-500', label: 'Active'   },
    inactive: { cls: 'bg-slate-300',   label: 'Inactive' },
    error:    { cls: 'bg-red-500',     label: 'Error'    },
  };
  const { cls, label } = map[status] ?? { cls: 'bg-slate-300', label: status };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`} />
      <span className="text-[12px] text-slate-600">{label}</span>
    </span>
  );
}

/* ─── Protocol tag ─── */
function ProtocolTag({ protocol }: { protocol: string }) {
  const label = protocol === 'tcp_udp' ? 'TCP/UDP' : protocol.toUpperCase();
  return (
    <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

/* ─── Algorithm label ─── */
function AlgoLabel({ algo }: { algo: string }) {
  const map: Record<string, string> = {
    round_robin: 'Round Robin',
    least_conn:  'Least Requests',
    ip_hash:     'IP Affinity',
    hash:        'Generic Hash',
  };
  return <span className="text-[12px] text-slate-600">{map[algo] ?? algo}</span>;
}

/* ─── Main page ─── */
export default function NetworkLoadBalancer() {
  const [page, setPage]                 = useState(1);
  const [limit]                         = useState(10);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editNLB, setEditNLB]           = useState<NLBType | null>(null);
  const [confirmDel, setConfirmDel]     = useState<{ open: boolean; nlb: NLBType | null }>({
    open: false, nlb: null,
  });

  const { data, isLoading } = useNLBs({
    page, limit, search,
    status: statusFilter,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const { data: stats } = useNLBStats();
  const deleteMutation  = useDeleteNLB();
  const toggleMutation  = useToggleNLB();

  const totalCount = stats?.totalNLBs ?? 0;
  const nlbs       = data?.data        ?? [];
  const pagination = data?.pagination;
  const isFiltered = search !== '' || statusFilter !== '';

  const handleEdit = (nlb: NLBType) => { setEditNLB(nlb); setDialogOpen(true); };

  const handleToggle = async (nlb: NLBType) => {
    try {
      await toggleMutation.mutateAsync({ id: nlb.id, enabled: !nlb.enabled });
      toast.success(`${nlb.name} ${!nlb.enabled ? 'enabled' : 'disabled'}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to toggle NLB');
    }
  };

  const confirmDelete = async () => {
    if (!confirmDel.nlb) return;
    try {
      await deleteMutation.mutateAsync(confirmDel.nlb.id);
      toast.success(`${confirmDel.nlb.name} deleted`);
      setConfirmDel({ open: false, nlb: null });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete NLB');
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-slate-800">Network Load Balancers</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Layer 4 TCP/UDP traffic distribution · origin health probing · automatic failover
          </p>
        </div>
        {!isLoading && totalCount > 0 && (
          <button
            onClick={() => { setEditNLB(null); setDialogOpen(true); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Deploy Load Balancer
          </button>
        )}
      </div>

      {/* ── Stats row — always visible when data present ── */}
      {stats && totalCount > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Listeners"
            value={stats.totalNLBs}
            sub={`${stats.activeNLBs} active`}
            icon={Network}
            iconColor="text-primary"
          />
          <StatCard
            label="Active"
            value={stats.activeNLBs}
            sub={`${stats.inactiveNLBs} inactive`}
            icon={Activity}
            iconColor="text-emerald-500"
          />
          <StatCard
            label="Origin Servers"
            value={stats.totalUpstreams}
            sub="across all pools"
            icon={Server}
            iconColor="text-amber-500"
          />
          <StatCard
            label="Healthy Origins"
            value={stats.healthyUpstreams}
            sub={`${stats.unhealthyUpstreams} unreachable`}
            icon={CheckCircle2}
            iconColor={stats.unhealthyUpstreams > 0 ? 'text-red-500' : 'text-emerald-500'}
          />
        </div>
      )}

      {/* ── Empty onboarding state ── */}
      {!isLoading && totalCount === 0 && (
        <div className="bg-white border border-slate-100 rounded-lg py-16 flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
            <Network className="h-5 w-5 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No load balancers deployed</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mb-5">
            Deploy a Layer 4 listener to distribute TCP or UDP traffic across an origin server pool
            with health probing and automatic failover.
          </p>
          <button
            onClick={() => { setEditNLB(null); setDialogOpen(true); }}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Deploy Load Balancer
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="bg-white border border-slate-100 rounded-lg px-8 py-10">
          <p className="text-[12px] text-slate-400">Loading...</p>
        </div>
      )}

      {/* ── Table + filters (only when data exists) ── */}
      {!isLoading && totalCount > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Filter listeners..."
                className="h-8 pl-8 pr-3 w-52 text-[12px] rounded-md border border-slate-200 bg-white text-slate-700 outline-none focus:border-primary transition-colors placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-8 pl-3 pr-8 text-[12px] rounded-md border border-slate-200 text-slate-600 bg-white outline-none focus:border-primary transition-colors appearance-none">
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="error">Error</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▾</span>
            </div>
            {isFiltered && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
                className="text-[11px] text-slate-400 hover:text-slate-700 underline">
                Clear
              </button>
            )}
          </div>

          {/* Filtered empty */}
          {nlbs.length === 0 && isFiltered ? (
            <div className="bg-white border border-slate-100 rounded-lg py-12 flex flex-col items-center text-center">
              <Search className="h-7 w-7 text-slate-200 mb-2" />
              <p className="text-sm text-slate-500 font-medium">No results match this filter</p>
              <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
                className="mt-2 text-[12px] text-primary hover:underline">
                Clear filter
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left pl-5 pr-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Listener</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Port</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Protocol</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Distribution</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Origins</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Enabled</th>
                    <th className="pr-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {nlbs.map(nlb => {
                    const upCount = nlb.upstreams.length;
                    const upUp    = nlb.upstreams.filter(u => u.status === 'up').length;
                    const allDown = upCount > 0 && upUp === 0;
                    return (
                      <tr key={nlb.id} className={`hover:bg-slate-50/50 transition-colors ${allDown ? 'bg-red-50/30' : ''}`}>
                        <td className="pl-5 pr-4 py-3">
                          <div className="font-medium text-slate-800">{nlb.name}</div>
                          {nlb.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{nlb.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">{nlb.port}</td>
                        <td className="px-4 py-3"><ProtocolTag protocol={nlb.protocol} /></td>
                        <td className="px-4 py-3"><AlgoLabel algo={nlb.algorithm} /></td>
                        <td className="px-4 py-3">
                          <span className={upUp === upCount ? 'text-emerald-600 font-medium' : upUp === 0 ? 'text-red-500 font-medium' : 'text-amber-500 font-medium'}>{upUp}</span>
                          <span className="text-slate-400"> / {upCount} healthy</span>
                        </td>
                        <td className="px-4 py-3"><StatusDot status={nlb.status} /></td>
                        <td className="px-4 py-3">
                          {nlb.enabled
                            ? <span className="text-[11px] font-semibold text-emerald-600">On</span>
                            : <span className="text-[11px] text-slate-400">Off</span>}
                        </td>
                        <td className="pr-5 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-slate-100 transition-colors">
                                <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-[12px]">
                              <DropdownMenuItem onClick={() => handleEdit(nlb)} className="gap-2 cursor-pointer">
                                <Edit className="h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(nlb)} className="gap-2 cursor-pointer">
                                {nlb.enabled
                                  ? <><PowerOff className="h-3.5 w-3.5" /> Disable</>
                                  : <><Power className="h-3.5 w-3.5" /> Enable</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setConfirmDel({ open: true, nlb })}
                                className="gap-2 cursor-pointer text-red-600 focus:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    {((page - 1) * limit) + 1}–{Math.min(page * limit, pagination.totalCount)} of {pagination.totalCount}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={!pagination.hasPreviousPage}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                    <span className="text-[11px] text-slate-500 px-1">{page} / {pagination.totalPages}</span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!pagination.hasNextPage}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Form dialog ── */}
      <NLBFormDialog
        isOpen={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditNLB(null); }}
        nlb={editNLB}
        mode={editNLB ? 'edit' : 'create'}
      />

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={confirmDel.open}
        onOpenChange={open => setConfirmDel(p => ({ ...p, open }))}
        title="Delete Load Balancer"
        description={`Permanently delete "${confirmDel.nlb?.name}"? Its configuration and upstream bindings will be removed. This cannot be undone.`}
        onConfirm={confirmDelete}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
