import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import {
  Clock, Zap, AlertTriangle, Activity, RefreshCw,
  Download, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
} from "lucide-react";
import { domainService } from "@/services/domain.service";
import { SkeletonStatsCard } from "@/components/ui/skeletons";
import {
  useSuspensePerformanceStats,
  useSuspensePerformanceMetrics,
  useRefreshPerformanceData,
} from "@/queries/performance.query-options";
import type { PerformanceMetric } from "@/types";

const TIME_LABELS: Record<string, string> = {
  "5m": "5 min",
  "15m": "15 min",
  "1h": "1 hour",
  "6h": "6 hours",
  "24h": "24 hours",
};

function formatTs(ts: string | Date, timeRange: string) {
  const d = new Date(ts);
  if (timeRange === "24h" || timeRange === "6h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusOf(rt: number, er: number): "NOMINAL" | "DEGRADED" | "CRITICAL" {
  if (rt > 500 || er > 5) return "CRITICAL";
  if (rt > 200 || er > 3) return "DEGRADED";
  return "NOMINAL";
}

const STATUS_STYLE: Record<string, string> = {
  NOMINAL: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  DEGRADED: "bg-amber-50 text-amber-700 border border-amber-200",
  CRITICAL: "bg-red-50 text-red-700 border border-red-200",
};

function TrendIcon({ value, threshold }: { value: number; threshold: number }) {
  if (value > threshold) return <TrendingUp className="h-3 w-3 text-red-500" />;
  if (value > threshold * 0.6) return <Minus className="h-3 w-3 text-amber-500" />;
  return <TrendingDown className="h-3 w-3 text-emerald-500" />;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded shadow-lg px-3 py-2 text-xs">
      <p className="text-slate-500 mb-1 font-mono">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-800">{p.value?.toFixed(2)}{p.unit}</span>
        </div>
      ))}
    </div>
  );
};

const PerformanceStats = ({
  domain, timeRange,
}: { domain: string; timeRange: string }) => {
  const { data: stats } = useSuspensePerformanceStats(domain, timeRange);

  const cards = [
    {
      label: "Latency (Avg)",
      sub: "Mean response time",
      value: `${stats.avgResponseTime.toFixed(0)}ms`,
      icon: Clock,
      color: stats.avgResponseTime > 500 ? "text-red-600" : stats.avgResponseTime > 200 ? "text-amber-600" : "text-emerald-600",
      trend: { value: stats.avgResponseTime, threshold: 200 },
    },
    {
      label: "Request Rate",
      sub: "Requests per second",
      value: `${stats.avgThroughput.toFixed(1)} rps`,
      icon: Zap,
      color: "text-blue-600",
      trend: null,
    },
    {
      label: "HTTP Error Rate",
      sub: "4xx + 5xx responses",
      value: `${stats.avgErrorRate.toFixed(2)}%`,
      icon: AlertTriangle,
      color: stats.avgErrorRate > 5 ? "text-red-600" : stats.avgErrorRate > 3 ? "text-amber-600" : "text-emerald-600",
      trend: { value: stats.avgErrorRate, threshold: 3 },
    },
    {
      label: "Request Volume",
      sub: "Total in window",
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
      color: "text-slate-800",
      trend: null,
    },
  ];

  return (
    <div className="grid gap-px md:grid-cols-2 lg:grid-cols-4 bg-slate-100 border border-slate-100 rounded-lg overflow-hidden">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-white px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{c.label}</span>
              <Icon className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <div className={`text-2xl font-bold leading-none tabular-nums ${c.color}`}>
              {c.value}
            </div>
            <div className="flex items-center gap-1">
              {c.trend && <TrendIcon value={c.trend.value} threshold={c.trend.threshold} />}
              <span className="text-[11px] text-slate-400">{c.sub}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MetricsChart = ({
  metrics, timeRange,
}: { metrics: PerformanceMetric[]; timeRange: string }) => {
  const [activeChart, setActiveChart] = useState<"latency" | "errorRate" | "throughput">("latency");

  const chartData = [...metrics]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((m) => ({
      ts: formatTs(m.timestamp, timeRange),
      latency: m.responseTime,
      errorRate: m.errorRate,
      throughput: m.throughput,
      requests: m.requestCount,
    }));

  const charts = {
    latency: {
      label: "Latency",
      unit: "ms",
      dataKey: "latency",
      color: "#6366f1",
      gradientId: "latencyGrad",
      refLine: 200,
      refLabel: "SLA 200ms",
    },
    errorRate: {
      label: "HTTP Error Rate",
      unit: "%",
      dataKey: "errorRate",
      color: "#ef4444",
      gradientId: "errorGrad",
      refLine: 3,
      refLabel: "Threshold 3%",
    },
    throughput: {
      label: "Request Rate",
      unit: " rps",
      dataKey: "throughput",
      color: "#3b82f6",
      gradientId: "throughputGrad",
      refLine: undefined,
      refLabel: undefined,
    },
  };

  const active = charts[activeChart];

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Metrics Timeseries</h2>
          <p className="text-xs text-slate-400 mt-0.5">Time-bucketed performance telemetry</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-md p-0.5">
          {(["latency", "errorRate", "throughput"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setActiveChart(k)}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                activeChart === k
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {charts[k].label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Activity className="h-8 w-8 mb-2 text-slate-200" />
          <p className="text-sm">No telemetry data in this window</p>
          <p className="text-xs text-slate-300 mt-1">Data populates once nginx is processing traffic</p>
        </div>
      ) : (
        <div className="px-5 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={active.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={active.color} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={active.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="ts"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}${active.unit}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {active.refLine !== undefined && (
                <ReferenceLine
                  y={active.refLine}
                  stroke={active.color}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: active.refLabel, position: "right", fontSize: 9, fill: active.color }}
                />
              )}
              <Area
                type="monotone"
                dataKey={active.dataKey}
                stroke={active.color}
                strokeWidth={1.5}
                fill={`url(#${active.gradientId})`}
                dot={false}
                name={active.label}
                unit={active.unit}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const MetricsTable = ({
  metrics, timeRange,
}: { metrics: PerformanceMetric[]; timeRange: string }) => {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? metrics.slice(0, 50) : metrics.slice(0, 8);

  if (metrics.length === 0) return null;

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Sample Points</h2>
          <p className="text-xs text-slate-400 mt-0.5">Per-interval metric snapshots</p>
        </div>
        <span className="text-xs text-slate-400">{metrics.length} intervals</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              {["Timestamp", "Protected Site", "Latency", "Req Rate", "Error Rate", "Req Count", "Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((m) => {
              const st = statusOf(m.responseTime, m.errorRate);
              return (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-slate-500">{formatTs(m.timestamp, timeRange)}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{m.domain}</td>
                  <td className={`px-4 py-2.5 font-mono font-medium ${
                    m.responseTime > 500 ? "text-red-600" : m.responseTime > 200 ? "text-amber-600" : "text-slate-700"
                  }`}>
                    {m.responseTime.toFixed(0)}ms
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{m.throughput.toFixed(1)} rps</td>
                  <td className={`px-4 py-2.5 font-mono ${
                    m.errorRate > 5 ? "text-red-600" : m.errorRate > 3 ? "text-amber-600" : "text-slate-600"
                  }`}>
                    {m.errorRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 tabular-nums">{m.requestCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${STATUS_STYLE[st]}`}>
                      {st}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {metrics.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Show less" : `Show ${metrics.length - 8} more intervals`}
        </button>
      )}
    </div>
  );
};

const DiagnosticsPanel = ({
  stats,
}: { stats: { slowRequests: Array<{ domain: string; timestamp: string; responseTime: number }>; highErrorPeriods: Array<{ domain: string; timestamp: string; errorRate: number }> } }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Latency Violations</h2>
          <p className="text-xs text-slate-400 mt-0.5">Requests exceeding 200ms SLA threshold</p>
        </div>
        <div className="divide-y divide-slate-50">
          {stats.slowRequests.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">All Clear</div>
              <p className="text-xs text-slate-400">No latency violations detected</p>
            </div>
          ) : (
            stats.slowRequests.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-xs font-medium text-slate-700">{r.domain}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </p>
                </div>
                <span className={`text-xs font-semibold font-mono px-2 py-0.5 rounded ${
                  r.responseTime > 500 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {r.responseTime.toFixed(0)}ms
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Error Spikes</h2>
          <p className="text-xs text-slate-400 mt-0.5">Intervals with HTTP error rate exceeding 3%</p>
        </div>
        <div className="divide-y divide-slate-50">
          {stats.highErrorPeriods.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">All Clear</div>
              <p className="text-xs text-slate-400">No error spikes detected</p>
            </div>
          ) : (
            stats.highErrorPeriods.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-xs font-medium text-slate-700">{r.domain}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </p>
                </div>
                <span className={`text-xs font-semibold font-mono px-2 py-0.5 rounded ${
                  r.errorRate > 10 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {r.errorRate.toFixed(2)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const PerformanceBody = ({
  domain, timeRange,
}: { domain: string; timeRange: string }) => {
  const { data: stats } = useSuspensePerformanceStats(domain, timeRange);
  const { data: metrics } = useSuspensePerformanceMetrics(domain, timeRange);

  return (
    <>
      <MetricsChart metrics={metrics} timeRange={timeRange} />
      <MetricsTable metrics={metrics} timeRange={timeRange} />
      <DiagnosticsPanel stats={stats} />
    </>
  );
};

const Performance = () => {
  const [domains, setDomains] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [timeRange, setTimeRange] = useState("1h");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const refreshData = useRefreshPerformanceData();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    domainService.getAll().then((res) => setDomains(res.data || [])).catch(() => {});
  }, []);

  const handleRefresh = useCallback(() => {
    refreshData();
    setLastRefresh(new Date());
  }, [refreshData]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(handleRefresh, 30_000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, handleRefresh]);

  const handleExport = () => {
    const rows = [["Domain", "Time Range", "Exported At"], [selectedDomain, TIME_LABELS[timeRange], lastRefresh.toISOString()]];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `performance-${selectedDomain}-${timeRange}-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Performance</h1>
          <p className="text-sm text-slate-400 mt-0.5">Request latency, throughput, and error telemetry</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDomain} onValueChange={setSelectedDomain}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protected Sites</SelectItem>
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">Last 5 min</SelectItem>
              <SelectItem value="15m">Last 15 min</SelectItem>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs gap-1.5 ${autoRefresh ? "border-blue-300 text-blue-600 bg-blue-50" : ""}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-3 w-3 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto 30s" : "Auto Refresh"}
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleRefresh}>
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleExport}>
            <Download className="h-3 w-3" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>Window: <span className="font-medium text-slate-600">{TIME_LABELS[timeRange]}</span></span>
          <span className="text-slate-200">|</span>
          <span>Scope: <span className="font-medium text-slate-600">{selectedDomain === "all" ? "All Protected Sites" : selectedDomain}</span></span>
          <span className="text-slate-200">|</span>
          <span>Updated: <span className="font-medium text-slate-600 font-mono">{lastRefresh.toLocaleTimeString()}</span></span>
        </div>
        {autoRefresh && (
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider animate-pulse">
            Live
          </span>
        )}
      </div>

      <Suspense
        fallback={
          <div className="grid gap-px md:grid-cols-2 lg:grid-cols-4 bg-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
            <SkeletonStatsCard />
          </div>
        }
      >
        <PerformanceStats domain={selectedDomain} timeRange={timeRange} />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-lg h-72 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <Activity className="h-8 w-8 animate-pulse" />
                <span className="text-xs">Loading telemetry…</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-white border border-slate-100 rounded-lg h-40" />
              <div className="bg-white border border-slate-100 rounded-lg h-40" />
            </div>
          </div>
        }
      >
        <PerformanceBody domain={selectedDomain} timeRange={timeRange} />
      </Suspense>
    </div>
  );
};

export default Performance;
