import { useState, useEffect, useMemo, useCallback, Suspense, ElementType } from "react";
import { toast } from 'sonner';

import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  Download,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  AlertTriangle,
  Shield,
  CheckCircle2,
  Flag,
  EyeOff,
  Eye,
  Copy,
  Maximize2,
  X,
} from "lucide-react";
import {
  useQueryState,
  parseAsInteger,
  parseAsString,
} from "nuqs";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogEntry } from "@/types";
import { downloadLogs } from "@/services/logs.service";
import { SkeletonStatsCard, SkeletonTable } from "@/components/ui/skeletons";
import {
  useSuspenseLogStatistics,
  useSuspenseAvailableDomains,
  useLogs
} from "@/queries/logs.query-options";
import { LogDetailsDialog } from "@/components/logs/LogDetailsDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── WAF-grade constants ──────────────────────────────────────────────────────

const SEVERITY_OPTIONS = [
  { value: "all",     label: "All Severities" },
  { value: "info",    label: "PASS"  },
  { value: "warning", label: "ALERT" },
  { value: "error",   label: "BLOCK" },
] as const;

const EVENT_TYPE_OPTIONS = [
  { value: "all",    label: "All Event Types" },
  { value: "access", label: "Access Log"     },
  { value: "error",  label: "Engine Error"   },
  { value: "system", label: "System Event"   },
] as const;

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100] as const;

const STATS_CONFIG = [
  { key: "total",   label: "Total Events", color: "",               description: "All ingested events",           path: undefined        },
  { key: "info",    label: "PASS Events",  color: "text-emerald-600", description: "Requests allowed through",    path: "byLevel.info"   },
  { key: "warning", label: "ALERT Events", color: "text-amber-500",  description: "Suspicious / flagged requests", path: "byLevel.warning" },
  { key: "error",   label: "BLOCK Events", color: "text-red-500",    description: "Requests blocked by WAF rules",  path: "byLevel.error"  },
] as const;

// ── Helper functions ─────────────────────────────────────────────────────────

const getSeverityBadge = (level: string) => {
  switch (level) {
    case "error":   return { label: "BLOCK", cls: "bg-red-50 text-red-700 border border-red-200 font-semibold"    };
    case "warning": return { label: "ALERT", cls: "bg-amber-50 text-amber-700 border border-amber-200 font-semibold" };
    case "info":    return { label: "PASS",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold" };
    default:        return { label: level.toUpperCase(), cls: "bg-slate-50 text-slate-600 border border-slate-200" };
  }
};

const getEventTypeBadge = (type: string) => {
  switch (type) {
    case "access": return { label: "ACCESS", cls: "bg-blue-50 text-blue-700 border border-blue-200"     };
    case "error":  return { label: "ENGINE", cls: "bg-red-50 text-red-700 border border-red-200"       };
    case "system": return { label: "SYSTEM", cls: "bg-slate-50 text-slate-600 border border-slate-200" };
    default:       return { label: type.toUpperCase(), cls: "bg-slate-50 text-slate-600 border border-slate-200" };
  }
};

const getNestedValue = (obj: any, path: string) =>
  path.split('.').reduce((acc, part) => acc?.[part], obj);

const buildFilterParams = (filters: {
  level: string; type: string; domain: string; search: string;
  ruleId: string; uniqueId: string; page?: number; limit?: number;
}) => {
  const params: any = {};
  if (filters.page)  params.page  = filters.page;
  if (filters.limit) params.limit = filters.limit;
  const configs = [
    { key: "level",    value: filters.level,    exclude: "all" },
    { key: "type",     value: filters.type,     exclude: "all" },
    { key: "domain",   value: filters.domain,   exclude: "all" },
    { key: "search",   value: filters.search  },
    { key: "ruleId",   value: filters.ruleId  },
    { key: "uniqueId", value: filters.uniqueId },
  ];
  configs.forEach(({ key, value, exclude }) => {
    if (value && value !== exclude) params[key] = value;
  });
  return params;
};

const fmtTimestamp = (ts: string) => {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
};

// ── Sub-components ────────────────────────────────────────────────────────────


const STAT_ICONS: Record<string, { icon: ElementType; iconColor: string }> = {
  total:   { icon: FileText,      iconColor: "text-slate-400"   },
  info:    { icon: CheckCircle2,  iconColor: "text-emerald-500" },
  warning: { icon: AlertTriangle, iconColor: "text-amber-500"   },
  error:   { icon: Shield,        iconColor: "text-red-500"     },
};

const StatCard = ({ stat, value }: { stat: typeof STATS_CONFIG[number]; value: number }) => {
  const { icon: Icon, iconColor } = (STAT_ICONS[stat.key] ?? STAT_ICONS['total']) as { icon: ElementType; iconColor: string };
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className={`text-2xl font-bold leading-none ${stat.color || "text-slate-800"}`}>
        {value?.toLocaleString() ?? "—"}
      </div>
      <p className="text-[11px] text-slate-400">{stat.description}</p>
    </div>
  );
};

const LogStatistics = () => {
  const { data: stats } = useSuspenseLogStatistics();
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {STATS_CONFIG.map((stat) => {
        const value = stat.path
          ? getNestedValue(stats, stat.path)
          : (stats as any)[stat.key];
        return <StatCard key={stat.key} stat={stat} value={value} />;
      })}
    </div>
  );
};

const useCustomEvent = (eventName: string, handler: (value: any) => void) => {
  useEffect(() => {
    const handle = (e: any) => handler(e.detail);
    window.addEventListener(eventName, handle);
    return () => window.removeEventListener(eventName, handle);
  }, [eventName, handler]);
};

const dispatchCustomEvent = (eventName: string, value: any) =>
  window.dispatchEvent(new CustomEvent(eventName, { detail: value }));

const FilterInput = ({
  placeholder, value, eventName, className = "", icon: Icon,
}: { placeholder: string; value: string; eventName: string; className?: string; icon?: any }) => (
  <div className={`relative ${className}`}>
    {Icon && <Icon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />}
    <Input
      placeholder={placeholder}
      value={value}
      onChange={(e) => dispatchCustomEvent(eventName, e.target.value)}
      onPaste={(e) => { e.preventDefault(); dispatchCustomEvent(eventName, e.clipboardData.getData("text/plain")); }}
      className={Icon ? "pl-8 h-9 text-[13px]" : "h-9 text-[13px]"}
    />
    {value && (
      <button
        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
        onClick={() => dispatchCustomEvent(eventName, "")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

const FilterSelect = ({
  value, options, eventName, className = "", placeholder = "Select",
}: { value: string; options: readonly { value: string; label: string }[]; eventName: string; className?: string; placeholder?: string }) => (
  <Select value={value} onValueChange={(val) => dispatchCustomEvent(eventName, val)}>
    <SelectTrigger className={`h-9 text-[13px] ${className}`}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.map((opt) => (
        <SelectItem key={opt.value} value={opt.value} className="text-[13px]">{opt.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const PaginationButton = ({ onClick, disabled, icon: Icon, label, className = "" }: {
  onClick: () => void; disabled: boolean; icon: any; label: string; className?: string;
}) => (
  <Button variant="outline" className={`h-8 w-8 p-0 ${className}`} onClick={onClick} disabled={disabled}>
    <span className="sr-only">{label}</span>
    <Icon className="h-4 w-4" />
  </Button>
);

// ── LogEntries component ──────────────────────────────────────────────────────

const LogEntries = ({
  page, limit, search, level, type, domain, ruleId, uniqueId,
  setPage, setLimit, sorting, setSorting, columnFilters, setColumnFilters,
  columnVisibility, setColumnVisibility, rowSelection, setRowSelection,
  autoRefresh, toast: _toastFn, onRefetch, selectedLog: _selectedLog, setSelectedLog,
  flaggedIds, onFlag, dismissedIds, onDismiss, onBulkDismiss, showDismissed,
}: {
  page: number; limit: number; search: string; level: string; type: string;
  domain: string; ruleId: string; uniqueId: string;
  setPage: (v: number) => void; setLimit: (v: number) => void;
  sorting: SortingState; setSorting: (v: SortingState) => void;
  columnFilters: ColumnFiltersState; setColumnFilters: (v: ColumnFiltersState) => void;
  columnVisibility: VisibilityState; setColumnVisibility: (v: VisibilityState) => void;
  rowSelection: Record<string, boolean>; setRowSelection: (v: Record<string, boolean>) => void;
  autoRefresh: boolean; toast: any; onRefetch: (refetch: () => Promise<any>) => void;
  selectedLog: LogEntry | null; setSelectedLog: (log: LogEntry | null) => void;
  flaggedIds: Set<string>; onFlag: (id: string) => void;
  dismissedIds: Set<string>; onDismiss: (id: string) => void;
  onBulkDismiss: (ids: string[]) => void; showDismissed: boolean;
}) => {
  const [isPageChanging, setIsPageChanging] = useState(false);

  const stableUniqueId = useMemo(() => uniqueId ? String(uniqueId) : "", [uniqueId]);

  const params = useMemo(() =>
    buildFilterParams({ level, type, domain, search, ruleId, uniqueId: stableUniqueId, page, limit }),
    [page, limit, level, type, domain, search, ruleId, stableUniqueId]
  );

  const { data: logsResponse, refetch, isFetching, isLoading } = useLogs(params);
  const { data: domains } = useSuspenseAvailableDomains();

  const allLogs: LogEntry[] = logsResponse?.data || [];
  const pagination = logsResponse?.pagination || { total: 0, totalPages: 1 };

  const logs = useMemo(() =>
    showDismissed ? allLogs : allLogs.filter((l) => !dismissedIds.has(l.id ?? l.uniqueId ?? "")),
    [allLogs, dismissedIds, showDismissed]
  );

  useEffect(() => { onRefetch(refetch); }, [refetch, onRefetch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  useEffect(() => {
    setIsPageChanging(isFetching && !isLoading);
  }, [isFetching, isLoading]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied`);
    }).catch(() => toast.error("Copy failed"));
  }, []);

  const domainOptions = useMemo(() => [
    { value: "all", label: "All Protected Sites" },
    ...(domains || []).map((d: any) => ({ value: d.name || d, label: d.name || d })),
  ], [domains]);

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const columns = useMemo<ColumnDef<LogEntry>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          className="border-slate-300"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          className="border-slate-300"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "timestamp",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Event Time <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ row }) => {
        const { date, time } = fmtTimestamp(row.getValue("timestamp"));
        return (
          <div className="font-mono text-[11px] leading-tight">
            <div className="text-slate-500">{date}</div>
            <div className="text-slate-800 font-medium">{time}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "level",
      header: () => <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Severity</span>,
      cell: ({ row }) => {
        const { label, cls } = getSeverityBadge(row.getValue("level"));
        return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${cls}`}>{label}</span>;
      },
    },
    {
      accessorKey: "type",
      header: () => <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Event Type</span>,
      cell: ({ row }) => {
        const { label, cls } = getEventTypeBadge(row.getValue("type"));
        return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${cls}`}>{label}</span>;
      },
    },
    {
      accessorKey: "source",
      header: () => <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Client IP</span>,
      cell: ({ row }) => {
        const ip = row.getValue("source") as string;
        return ip ? (
          <button
            className="font-mono text-[12px] text-slate-700 hover:text-blue-600 transition-colors"
            onClick={() => copyToClipboard(ip, "Client IP")}
            title="Click to copy"
          >
            {ip}
          </button>
        ) : <span className="text-slate-400 text-xs">—</span>;
      },
    },
    {
      accessorKey: "domain",
      header: () => <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Protected Site</span>,
      cell: ({ row }) => {
        const d = row.getValue("domain") as string;
        return d ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700">{d}</span>
        ) : <span className="text-slate-400 text-xs">—</span>;
      },
    },
    {
      accessorKey: "message",
      header: () => <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Event Summary</span>,
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div className="max-w-sm">
            <div className="text-[12px] text-slate-700 truncate">{log.message}</div>
            {log.ruleId && (
              <div className="text-[10px] text-red-600 font-mono mt-0.5">Rule {log.ruleId}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</span>,
      cell: ({ row }) => {
        const log = row.original;
        const logId = log.id ?? log.uniqueId ?? row.index.toString();
        const isFlagged  = flaggedIds.has(logId);
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                  onClick={() => setSelectedLog(log)}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Inspect event</TooltipContent>
            </Tooltip>

            {log.uniqueId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                    onClick={() => copyToClipboard(log.uniqueId!, "Request ID")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy Request ID</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm"
                  className={`h-7 w-7 p-0 transition-colors ${isFlagged ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-amber-500"}`}
                  onClick={() => {
                    onFlag(logId);
                    toast.success(isFlagged ? "Flag removed" : "Event flagged for review");
                  }}
                >
                  <Flag className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFlagged ? "Remove flag" : "Flag for investigation"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                  onClick={() => {
                    onDismiss(logId);
                    toast.success("Event dismissed from view");
                  }}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss from view</TooltipContent>
            </Tooltip>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [flaggedIds, dismissedIds, onFlag, onDismiss, setSelectedLog, copyToClipboard]);

  const handleSortingChange = useCallback(
    (updater: any) => setSorting(typeof updater === "function" ? updater(sorting) : updater),
    [sorting, setSorting]
  );
  const handleColumnFiltersChange = useCallback(
    (updater: any) => setColumnFilters(typeof updater === "function" ? updater(columnFilters) : updater),
    [columnFilters, setColumnFilters]
  );
  const handleColumnVisibilityChange = useCallback(
    (updater: any) => setColumnVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
    [columnVisibility, setColumnVisibility]
  );
  const handleRowSelectionChange = useCallback(
    (updater: any) => setRowSelection(typeof updater === "function" ? updater(rowSelection) : updater),
    [rowSelection, setRowSelection]
  );

  const table = useReactTable({
    data: logs,
    columns,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: handleRowSelectionChange,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    manualPagination: true,
    pageCount: pagination.totalPages,
  });

  const paginationButtons = [
    { icon: ChevronsLeft,  label: "First page",    onClick: () => setPage(1),           disabled: page <= 1 },
    { icon: ChevronLeft,   label: "Previous page", onClick: () => setPage(page - 1),    disabled: page <= 1 },
    { icon: ChevronRight,  label: "Next page",     onClick: () => setPage(page + 1),    disabled: page >= pagination.totalPages },
    { icon: ChevronsRight, label: "Last page",     onClick: () => setPage(pagination.totalPages), disabled: page >= pagination.totalPages },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      {/* ── Filter bar ── */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-800">
              Event Stream
              {pagination.total > 0 && (
                <span className="ml-2 text-[11px] font-normal text-slate-400">
                  {pagination.total.toLocaleString()} events matched
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400">Ingested from Nginx access.log · ModSecurity audit.log</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="outline" size="sm"
                className="h-8 text-[12px] text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  onBulkDismiss(selectedIds);
                  setRowSelection({});
                  toast.success(`${selectedIds.length} event${selectedIds.length > 1 ? "s" : ""} dismissed`);
                }}
              >
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                Dismiss {selectedIds.length}
              </Button>
            )}
            {dismissedIds.size > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400" onClick={() => onBulkDismiss([])}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Show {dismissedIds.size} dismissed events</TooltipContent>
              </Tooltip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1">
                  Columns <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table.getAllColumns().filter((c) => c.getCanHide()).map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize text-[12px]"
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          <FilterInput
            placeholder="Filter by IP, URI, message…"
            value={search}
            eventName="searchChange"
            icon={Search}
            className="flex-1 min-w-48"
          />
          <FilterInput
            placeholder="ModSec Rule ID"
            value={ruleId}
            eventName="ruleIdChange"
            className="w-36"
          />
          <FilterInput
            placeholder="Request ID"
            value={uniqueId}
            eventName="uniqueIdChange"
            className="w-44"
          />
          <FilterSelect
            value={domain}
            options={domainOptions}
            eventName="domainChange"
            className="w-44"
          />
          <FilterSelect
            value={level}
            options={SEVERITY_OPTIONS}
            eventName="levelChange"
            className="w-36"
          />
          <FilterSelect
            value={type}
            options={EVENT_TYPE_OPTIONS}
            eventName="typeChange"
            className="w-36"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className={`transition-opacity ${isPageChanging ? "opacity-60" : ""}`}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="py-2.5 px-3">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j} className="px-3 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (j * 17) % 40}%` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const log = row.original;
                const logId = log.id ?? log.uniqueId ?? row.index.toString();
                const isFlagged   = flaggedIds.has(logId);
                const isDismissed = dismissedIds.has(logId);
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer
                      ${isFlagged   ? "bg-amber-50/30" : ""}
                      ${isDismissed ? "opacity-40"     : ""}
                    `}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,input")) return;
                      setSelectedLog(log);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FileText className="h-8 w-8 text-slate-200" />
                    <span className="text-[13px]">No events matched your filter criteria</span>
                    <span className="text-[11px]">Try adjusting the severity, event type, or date range</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Footer: pagination ── */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-500">Rows per page</span>
          <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-16 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)} className="text-[12px]">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedIds.length > 0 && (
            <span className="text-[12px] text-slate-500 ml-2">{selectedIds.length} selected</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-slate-500">
            Page {page} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-1">
            {paginationButtons.map((btn, idx) => (
              <PaginationButton key={idx} {...btn} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const Logs = () => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logsRefetch, setLogsRefetch] = useState<(() => Promise<any>) | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Flagged & dismissed state (session-scoped, not persisted)
  const [flaggedIds,   setFlaggedIds]   = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showDismissed] = useState(false);

  const handleFlag = useCallback((id: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleBulkDismiss = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      setDismissedIds(new Set()); // restore
    } else {
      setDismissedIds((prev) => new Set([...prev, ...ids]));
    }
  }, []);

  // URL state
  const [page,   setPage]   = useQueryState("page",   parseAsInteger.withDefault(1));
  const [limit,  setLimit]  = useQueryState("limit",  parseAsInteger.withDefault(10));
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [level,  setLevel]  = useQueryState("level",  parseAsString.withDefault("all"));
  const [type,   setType]   = useQueryState("type",   parseAsString.withDefault("all"));
  const [domain, setDomain] = useQueryState("domain", parseAsString.withDefault("all"));
  const [ruleId, setRuleId] = useQueryState("ruleId", parseAsString.withDefault(""));

  const [uniqueId, setUniqueIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("uniqueId") || "";
    }
    return "";
  });

  const setUniqueId = useCallback((value: string) => {
    setUniqueIdState(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      value ? url.searchParams.set("uniqueId", value) : url.searchParams.delete("uniqueId");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Table state
  const [sorting,          setSorting]          = useState<SortingState>([]);
  const [columnFilters,    setColumnFilters]    = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection,     setRowSelection]     = useState<Record<string, boolean>>({});

  // Custom event handlers
  useCustomEvent("searchChange", setSearch);
  useCustomEvent("domainChange", setDomain);
  useCustomEvent("levelChange",  setLevel);
  useCustomEvent("typeChange",   setType);
  useCustomEvent("ruleIdChange", setRuleId);
  useCustomEvent("uniqueIdChange", setUniqueId);

  const handleDownloadLogs = useCallback(async () => {
    try {
      const downloadParams = buildFilterParams({ level, type, domain, search, ruleId, uniqueId, limit: 1000 });
      await downloadLogs(downloadParams);
      toast.success("Logs exported", { description: "Log data downloaded successfully." });
    } catch (error: any) {
      toast.error("Export failed", { description: error.response?.data?.message || "Failed to export logs." });
    }
  }, [level, type, domain, search, ruleId, uniqueId]);

  const handleSetRefetch = useCallback((refetch: () => Promise<any>) => {
    setLogsRefetch(() => refetch);
  }, []);

  const activeFilters = [level !== "all", type !== "all", domain !== "all", !!search, !!ruleId, !!uniqueId].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Event Log</h1>
          <p className="text-[13px] text-slate-400">
            Real-time WAF event stream · Nginx access log · ModSecurity audit log
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dismissedIds.size > 0 && (
            <Button
              variant="outline" size="sm"
              className="h-8 text-[12px] text-slate-500 gap-1.5"
              onClick={() => { setDismissedIds(new Set()); toast.success("All dismissed events restored"); }}
            >
              <Eye className="h-3.5 w-3.5" />
              Restore {dismissedIds.size} dismissed
            </Button>
          )}
          {flaggedIds.size > 0 && (
            <span className="inline-flex items-center gap-1 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
              <Flag className="h-3 w-3" />
              {flaggedIds.size} flagged
            </span>
          )}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Live" : "Auto Refresh"}
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-8 text-[12px]"
            onClick={async () => {
              if (logsRefetch) {
                setIsReloading(true);
                try { await logsRefetch(); } finally { setIsReloading(false); }
              }
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isReloading ? "animate-spin" : ""}`} />
            Reload
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[12px]" onClick={handleDownloadLogs}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <Suspense fallback={
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatsCard key={i} />)}
        </div>
      }>
        <LogStatistics />
      </Suspense>

      {/* ── Active filter indicator ── */}
      {activeFilters > 0 && (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
            {activeFilters} active filter{activeFilters > 1 ? "s" : ""}
          </span>
          <button
            className="text-slate-400 hover:text-slate-600 underline underline-offset-2"
            onClick={() => {
              setSearch(""); setLevel("all"); setType("all");
              setDomain("all"); setRuleId(""); setUniqueId("");
            }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Event stream table ── */}
      <Suspense fallback={
        <div className="bg-white border border-slate-100 rounded-lg p-6">
          <SkeletonTable />
        </div>
      }>
        <LogEntries
          page={page} limit={limit} search={search} level={level}
          type={type} domain={domain} ruleId={ruleId} uniqueId={uniqueId || ""}
          setPage={setPage} setLimit={setLimit}
          sorting={sorting} setSorting={setSorting}
          columnFilters={columnFilters} setColumnFilters={setColumnFilters}
          columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility}
          rowSelection={rowSelection} setRowSelection={setRowSelection}
          autoRefresh={autoRefresh} toast={toast}
          onRefetch={handleSetRefetch}
          selectedLog={selectedLog} setSelectedLog={setSelectedLog}
          flaggedIds={flaggedIds} onFlag={handleFlag}
          dismissedIds={dismissedIds} onDismiss={handleDismiss}
          onBulkDismiss={handleBulkDismiss} showDismissed={showDismissed}
        />
      </Suspense>

      <LogDetailsDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
    </div>
  );
};

export default Logs;
