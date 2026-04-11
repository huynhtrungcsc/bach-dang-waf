import { useState, useEffect } from 'react';
import {
  Plus, Search, Edit, Trash2, RefreshCw, Shield, ShieldOff, Globe,
  ChevronLeft, ChevronRight, ArrowUpDown, LayoutGrid, List,
  Lock, LockOpen, Network, Server, ShieldCheck
} from 'lucide-react';
import { Suspense } from 'react';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DomainDialogV2 } from '@/components/domains/DomainDialogV2';

import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  useCreateDomain,
  useUpdateDomain,
  useDeleteDomain,
  useToggleDomainSSL,
  useReloadNginx
} from '@/queries';
import { SkeletonTable } from '@/components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';
import { domainQueryOptions } from '@/queries/domain.query-options';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
} from '@tanstack/react-table';
import type { Domain } from '@/types';

const columnHelper = createColumnHelper<Domain>();

/* ─── Status badge ─── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active:   { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Active'   },
    inactive: { cls: 'bg-slate-50 text-slate-500 border border-slate-200',       label: 'Inactive' },
    error:    { cls: 'bg-red-50 text-red-600 border border-red-200',             label: 'Error'    },
  };
  const c = map[status] ?? map['inactive']!;
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md ${c.cls}`}>
      {c.label}
    </span>
  );
}

/* ─── Security pill ─── */
function SecurityPill({ on, type }: { on: boolean; type: 'ssl' | 'waf' }) {
  if (on) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
        <ShieldCheck className="h-3 w-3 text-emerald-500" />
        {type === 'ssl' ? 'TLS' : 'WAF'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
      {type === 'ssl' ? <LockOpen className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
      {type === 'ssl' ? 'No TLS' : 'WAF off'}
    </span>
  );
}

/* ─── Stat card — same design as Dashboard ─── */
function StatCard({
  icon: Icon, label, value, sub, iconColor,
}: { icon: any; label: string; value: number; sub?: string; iconColor: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold text-slate-800 leading-none tabular-nums">{value}</div>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

/* ─── Domain card (grid view) ─── */
function DomainCard({ domain, onEdit, onDelete, onToggleSSL, onToggleStatus }: {
  domain: Domain;
  onEdit: (d: Domain) => void;
  onDelete: (d: Domain) => void;
  onToggleSSL: (d: Domain) => void;
  onToggleStatus: (d: Domain, enabled: boolean) => void;
}) {
  const isActive = domain.status === 'active';
  const n = domain.upstreams?.length || 0;

  return (
    <div className="bg-white border border-slate-100 rounded-lg p-4 flex flex-col gap-3 hover:border-slate-200 transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 text-slate-300 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-[13px] text-slate-800 truncate">{domain.name}</p>
            <p className="text-[11px] text-slate-400">{n} upstream{n !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <StatusBadge status={domain.status} />
      </div>

      {/* Security row */}
      <div className="flex items-center gap-3 pt-0.5">
        <SecurityPill on={domain.sslEnabled} type="ssl" />
        <span className="text-slate-200 text-[10px]">|</span>
        <SecurityPill on={domain.modsecEnabled} type="waf" />
        {domain.http2Enabled && (
          <>
            <span className="text-slate-200 text-[10px]">|</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500">
              <Network className="h-3 w-3" /> HTTP/2
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => onToggleStatus(domain, checked)}
            className="scale-90"
          />
          <span className="text-[11px] text-slate-400">{isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onToggleSSL(domain)}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors"
            title={domain.sslEnabled ? 'Disable TLS' : 'Enable TLS'}>
            {domain.sslEnabled
              ? <Lock className="h-3.5 w-3.5 text-emerald-500" />
              : <LockOpen className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          <button
            onClick={() => onEdit(domain)}
            className="p-1.5 rounded hover:bg-slate-100 transition-colors">
            <Edit className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <button
            onClick={() => onDelete(domain)}
            className="p-1.5 rounded hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Onboarding empty state ─── */
function OnboardingEmptyState({ onAdd: _onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Globe className="h-5 w-5 text-slate-300" />
      </div>
      <p className="text-[14px] font-semibold text-slate-700 mb-1">No protected sites configured</p>
      <p className="text-[12px] text-slate-400 max-w-sm">
        Add a site to route HTTP/S traffic through the WAF. Each site supports TLS termination, WAF rules, and origin load balancing.
      </p>
    </div>
  );
}

/* ─── Filtered empty state ─── */
function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="text-[13px] text-slate-500 font-medium">No sites match the current filter.</p>
      <button onClick={onClear} className="mt-2 text-[12px] text-primary hover:underline">
        Clear filters
      </button>
    </div>
  );
}

/* ─── Main content ─── */
function DomainsContent() {
  const [searchTerm, setSearchTerm]         = useState('');
  const [sorting, setSorting]               = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters]   = useState<ColumnFiltersState>([]);
  const [pagination, setPagination]         = useState<PaginationState>({ pageIndex: 0, pageSize: 12 });
  const [statusFilter, setStatusFilter]     = useState('all');
  const [sslFilter, setSslFilter]           = useState('all');
  const [modsecFilter, setModsecFilter]     = useState('all');
  const [viewMode, setViewMode]             = useState<'grid' | 'table'>('grid');
  const reloadNginx = useReloadNginx();

  const handleApplyConfig = async () => {
    try {
      await reloadNginx.mutateAsync();
      toast.success('Configuration applied', { description: 'Nginx reloaded successfully.' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to apply configuration');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSslFilter('all');
    setModsecFilter('all');
    setPagination(p => ({ ...p, pageIndex: 0 }));
  };

  const queryParams = {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: searchTerm,
    status: statusFilter === 'all' ? '' : statusFilter,
    sslEnabled: sslFilter === 'all' ? undefined : sslFilter === 'true',
    modsecEnabled: modsecFilter === 'all' ? undefined : modsecFilter === 'true',
    sortBy: sorting[0]?.id || 'createdAt',
    sortOrder: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc',
  };

  const { data: allData } = useQuery(domainQueryOptions.all({
    page: 1, limit: 999, search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc'
  }));
  const { data, isLoading } = useQuery(domainQueryOptions.all(queryParams));

  const domains        = data?.data || [];
  const paginationInfo = data?.pagination;
  const allDomains     = allData?.data || [];

  const totalCount  = allData?.pagination?.totalCount ?? 0;
  const activeCount = allDomains.filter(d => d.status === 'active').length;
  const sslCount    = allDomains.filter(d => d.sslEnabled).length;
  const wafCount    = allDomains.filter(d => d.modsecEnabled).length;

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sslFilter !== 'all') params.set('sslEnabled', sslFilter);
    if (modsecFilter !== 'all') params.set('modsecEnabled', modsecFilter);
    if (pagination.pageIndex > 0) params.set('page', (pagination.pageIndex + 1).toString());
    window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
  }, [searchTerm, statusFilter, sslFilter, pagination, sorting]);

  const handleAdd          = () => window.dispatchEvent(new CustomEvent('add-domain'));
  const handleEdit         = (d: Domain) => window.dispatchEvent(new CustomEvent('edit-domain',    { detail: d }));
  const handleDelete       = (d: Domain) => window.dispatchEvent(new CustomEvent('delete-domain',  { detail: d }));
  const handleToggleSSL    = (d: Domain) => window.dispatchEvent(new CustomEvent('toggle-ssl',     { detail: d }));
  const handleToggleStatus = (d: Domain, enabled: boolean) =>
    window.dispatchEvent(new CustomEvent('toggle-status', { detail: { domain: d, enabled } }));

  const columns = [
    columnHelper.accessor('name', {
      header: 'Domain',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
          <span className="font-medium text-slate-800 text-[13px]">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('sslEnabled', {
      header: 'TLS',
      cell: (info) => <SecurityPill on={info.getValue()} type="ssl" />,
    }),
    columnHelper.accessor('modsecEnabled', {
      header: 'WAF',
      cell: (info) => <SecurityPill on={info.getValue()} type="waf" />,
    }),
    columnHelper.accessor('upstreams', {
      header: 'Upstreams',
      cell: (info) => {
        const n = info.getValue()?.length || 0;
        return <span className="text-[13px] text-slate-400 tabular-nums">{n} backend{n !== 1 ? 's' : ''}</span>;
      },
    }),
    columnHelper.accessor('status', {
      id: 'enabled',
      header: 'Active',
      cell: (info) => {
        const domain = info.row.original;
        return (
          <Switch
            checked={domain.status === 'active'}
            onCheckedChange={(checked) => handleToggleStatus(domain, checked)}
            className="scale-90"
          />
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => {
        const domain = info.row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => handleToggleSSL(domain)}
              title={domain.sslEnabled ? 'Disable TLS' : 'Enable TLS'}
              className="p-1.5 rounded hover:bg-slate-100 transition-colors">
              {domain.sslEnabled
                ? <Lock className="h-3.5 w-3.5 text-emerald-500" />
                : <LockOpen className="h-3.5 w-3.5 text-slate-400" />}
            </button>
            <button onClick={() => handleEdit(domain)}
              className="p-1.5 rounded hover:bg-slate-100 transition-colors">
              <Edit className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button onClick={() => handleDelete(domain)}
              className="p-1.5 rounded hover:bg-red-50 transition-colors">
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: domains,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    pageCount: paginationInfo?.totalPages || 0,
    state: { sorting, columnFilters, pagination },
  });

  const selCls = "h-8 pl-3 pr-8 text-[12px] rounded-md border border-slate-200 text-slate-600 bg-white outline-none focus:border-primary transition-colors appearance-none";

  /* CASE 1: No domains at all */
  if (totalCount === 0 && !isLoading) {
    return (
      <Card className="border-slate-100">
        <CardContent className="p-0">
          <OnboardingEmptyState onAdd={handleAdd} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={Globe}  label="Total"   value={totalCount}  sub="domains configured" iconColor="text-primary" />
        <StatCard icon={Server} label="Active"  value={activeCount} sub={`of ${totalCount}`}  iconColor="text-emerald-500" />
        <StatCard icon={Lock}   label="TLS"     value={sslCount}    sub="TLS enabled"         iconColor="text-blue-500" />
        <StatCard icon={Shield} label="WAF"     value={wafCount}    sub="WAF protected"       iconColor="text-violet-500" />
      </div>

      {/* ── Main panel ── */}
      <Card className="border-slate-100 overflow-hidden">
        <CardHeader className="pb-0 px-0 pt-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
              <input
                type="text"
                placeholder="Search domains…"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                className="w-full h-8 pl-8 pr-3 text-[12px] rounded-md border border-slate-200 text-slate-700 placeholder:text-slate-300 outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Filters */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selCls}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
            <select value={sslFilter} onChange={e => setSslFilter(e.target.value)} className={selCls}>
              <option value="all">All TLS</option>
              <option value="true">TLS On</option>
              <option value="false">TLS Off</option>
            </select>
            <select value={modsecFilter} onChange={e => setModsecFilter(e.target.value)} className={selCls}>
              <option value="all">All WAF</option>
              <option value="true">WAF On</option>
              <option value="false">WAF Off</option>
            </select>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2">
              {paginationInfo && (
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {paginationInfo.totalCount} domain{paginationInfo.totalCount !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={handleApplyConfig}
                disabled={reloadNginx.isPending}
                title="Reload Nginx to apply pending configuration changes"
                className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-3 w-3 ${reloadNginx.isPending ? 'animate-spin' : ''}`} />
                {reloadNginx.isPending ? 'Applying…' : 'Apply Config'}
              </button>
              <div className="flex items-center border border-slate-200 rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                  title="Grid view">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 border-l border-slate-200 transition-colors ${viewMode === 'table' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                  title="Table view">
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* ── Grid view ── */}
          {viewMode === 'grid' && (
            <div className="p-4">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-36 rounded-lg bg-slate-50 animate-pulse" />
                  ))}
                </div>
              ) : domains.length === 0 ? (
                <FilteredEmptyState onClear={clearFilters} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {domains.map(domain => (
                    <DomainCard
                      key={domain.id}
                      domain={domain}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleSSL={handleToggleSSL}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Table view ── */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {table.getHeaderGroups().map(hg =>
                      hg.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap"
                          onClick={header.column.getToggleSortingHandler()}
                          style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}>
                          <span className="flex items-center gap-1">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </span>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={columns.length} className="py-12 text-center text-[12px] text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length}>
                        <FilteredEmptyState onClear={clearFilters} />
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {paginationInfo && paginationInfo.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Page {pagination.pageIndex + 1} of {paginationInfo.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Domain action handlers ─── */
function DomainActions({ onAdd }: { onAdd: () => void }) {
  const toggleSSL    = useToggleDomainSSL();
  const deleteDomain = useDeleteDomain();
  const updateDomain = useUpdateDomain();
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: () => {} });

  const handleDeleteDomain = (domain: any) => setConfirmDialog({
    open: true,
    title: 'Delete Domain',
    description: `Delete "${domain.name}"? This cannot be undone and will remove all associated configuration.`,
    onConfirm: async () => {
      try {
        await deleteDomain.mutateAsync(domain.id);
        toast.success(`${domain.name} deleted`);
        setConfirmDialog(p => ({ ...p, open: false }));
      } catch (e: any) { toast.error(e.message || 'Failed to delete'); }
    },
  });

  const handleToggleSSL = (domain: any) => {
    const next = !domain.sslEnabled;
    if (next && !domain.sslCertificate) { toast.error('Cannot enable TLS: no certificate found for this domain.'); return; }
    setConfirmDialog({
      open: true,
      title: `${next ? 'Enable' : 'Disable'} TLS`,
      description: `${next ? 'Enable' : 'Disable'} TLS for "${domain.name}"?`,
      onConfirm: async () => {
        try {
          await toggleSSL.mutateAsync({ id: domain.id, sslEnabled: next });
          toast.success(`TLS ${next ? 'enabled' : 'disabled'} for ${domain.name}`);
          setConfirmDialog(p => ({ ...p, open: false }));
        } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to toggle TLS'); }
      },
    });
  };

  const handleToggleStatus = async ({ domain, enabled }: any) => {
    try {
      await updateDomain.mutateAsync({ id: domain.id, data: { status: enabled ? 'active' : 'inactive' } });
      toast.success(`${domain.name} ${enabled ? 'activated' : 'deactivated'}`);
    } catch (e: any) { toast.error(e.message || 'Failed to update'); }
  };

  useEffect(() => {
    const onAddEvt = ()               => onAdd();
    const onDelete = (e: CustomEvent) => handleDeleteDomain(e.detail);
    const onSSL    = (e: CustomEvent) => handleToggleSSL(e.detail);
    const onStatus = (e: CustomEvent) => handleToggleStatus(e.detail);
    window.addEventListener('add-domain',    onAddEvt  as EventListener);
    window.addEventListener('delete-domain', onDelete  as unknown as EventListener);
    window.addEventListener('toggle-ssl',    onSSL     as unknown as EventListener);
    window.addEventListener('toggle-status', onStatus  as unknown as EventListener);
    return () => {
      window.removeEventListener('add-domain',    onAddEvt  as EventListener);
      window.removeEventListener('delete-domain', onDelete  as unknown as EventListener);
      window.removeEventListener('toggle-ssl',    onSSL     as unknown as EventListener);
      window.removeEventListener('toggle-status', onStatus  as unknown as EventListener);
    };
  }, []);

  return (
    <ConfirmDialog
      open={confirmDialog.open}
      onOpenChange={open => setConfirmDialog(p => ({ ...p, open }))}
      title={confirmDialog.title}
      description={confirmDialog.description}
      onConfirm={confirmDialog.onConfirm}
      confirmText="Confirm"
      isLoading={deleteDomain.isPending || toggleSSL.isPending}
    />
  );
}

/* ─── Page root ─── */
export default function Domains() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);

  const createDomain = useCreateDomain();
  const updateDomain = useUpdateDomain();

  useEffect(() => {
    const onEdit = (e: CustomEvent) => { setEditDomain(e.detail); setDialogOpen(true); };
    window.addEventListener('edit-domain', onEdit as EventListener);
    return () => window.removeEventListener('edit-domain', onEdit as EventListener);
  }, []);

  const handleSave = (data: any) => {
    if (editDomain) {
      updateDomain.mutate(
        { id: editDomain.id, data },
        {
          onSuccess: () => {
            toast.success('Site updated successfully');
            setDialogOpen(false);
            setEditDomain(null);
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to update site');
          },
        }
      );
    } else {
      createDomain.mutate(data, {
        onSuccess: () => {
          toast.success('Site added successfully');
          setDialogOpen(false);
          setEditDomain(null);
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to add site');
        },
      });
    }
  };

  const isSaving = createDomain.isPending || updateDomain.isPending;

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Protected Sites</h1>
            <p className="text-sm text-slate-400">WAF routing · TLS · upstream backends</p>
          </div>
          <HeaderAddButton onClick={() => { setEditDomain(null); setDialogOpen(true); }} />
        </div>

        {/* Content */}
        <Suspense fallback={<SkeletonTable rows={5} columns={5} title="Protected Sites" />}>
          <DomainsContent />
        </Suspense>

        {/* Domain dialog */}
        <DomainDialogV2
          open={dialogOpen}
          onOpenChange={open => { setDialogOpen(open); if (!open) setEditDomain(null); }}
          domain={editDomain}
          onSave={handleSave}
          isLoading={isSaving}
        />

        {/* Event-driven actions */}
        <DomainActions onAdd={() => { setEditDomain(null); setDialogOpen(true); }} />
      </div>
    </TooltipProvider>
  );
}

/* ─── Header Add button — hidden when Nginx not installed ─── */
function HeaderAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors">
      <Plus className="h-3.5 w-3.5" />
      Add Site
    </button>
  );
}

/* ─── Installation gate ─── */
