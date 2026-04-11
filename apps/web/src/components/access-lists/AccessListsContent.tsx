import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Plus, Search, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { accessListsQueryOptions } from '@/queries/access-lists.query-options';
import { AccessListCard } from './AccessListCard';
import { AccessListFormDialog } from './AccessListFormDialog';
import { PaginationControls } from '@/components/ui/pagination-controls';

export function AccessListsContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data } = useSuspenseQuery(
    accessListsQueryOptions({
      page,
      limit: 10,
      search: search || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      enabled: enabledFilter === 'all' ? undefined : enabledFilter === 'true' ? true : false,
    })
  );

  const accessLists = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search access policies..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-8 text-[13px]"
            />
          </div>
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full md:w-[200px] h-8 text-[13px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="ip_whitelist">IP Source Allowlist</SelectItem>
            <SelectItem value="http_basic_auth">HTTP Basic Auth</SelectItem>
            <SelectItem value="combined">IP + Basic Auth</SelectItem>
          </SelectContent>
        </Select>

        <Select value={enabledFilter} onValueChange={(v) => { setEnabledFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full md:w-[160px] h-8 text-[13px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" className="h-8 text-[13px]" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Access Policy
        </Button>
      </div>

      {/* ── Access Policy List ── */}
      {accessLists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
          <ShieldOff className="h-8 w-8 text-slate-300" />
          <div>
            <p className="text-[13px] font-medium text-slate-600">No access policies defined</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Create an IP allowlist or HTTP Basic Auth policy and attach it to one or more domains</p>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-[13px] mt-1" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Access Policy
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {accessLists.map((accessList) => (
            <AccessListCard key={accessList.id} accessList={accessList} />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationControls
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      <AccessListFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
