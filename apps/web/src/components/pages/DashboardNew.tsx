import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { Suspense } from "react";
import {
  useSuspenseDashboardStats,
  useSuspenseSystemMetrics,
  useSuspenseRequestTrend,
  useSuspenseLatestAttackStats,
  useSuspenseLatestNews,
  useAttackRatio,
  useGeoStats,
  useGlobalModSecSettings,
  useCrsRules,
} from "@/queries";
import { ThreeGlobe } from "@/components/ui/ThreeGlobe";
import { EChartsMap } from "@/components/ui/EChartsMap";

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNum({ value, dec = 0 }: { value: number; dec?: number }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    if (!value) { setDisp(0); return; }
    let cur = 0;
    const step = value / 40;
    const t = setInterval(() => {
      cur = Math.min(cur + step, value);
      setDisp(cur);
      if (cur >= value) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <>{dec > 0 ? disp.toFixed(dec) : Math.floor(disp).toLocaleString()}</>;
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function Dot({ green = true }: { green?: boolean }) {
  const c = green ? 'bg-emerald-400' : 'bg-red-400';
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${c}`} />
    </span>
  );
}

// ── Bar-chart sparkline ────────────────────────────────────────────────────────
function SparkBars({ pts, color, h = 68 }: { pts: number[]; color: string; h?: number }) {
  if (!pts.length) return <div style={{ height: h }} className="flex items-center justify-center text-xs text-slate-300">–</div>;
  const W = 260;
  const max = Math.max(...pts, 1);
  const bw = W / pts.length;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
      {pts.map((v, i) => {
        const bh = Math.max(2, (v / max) * (h - 4));
        return (
          <rect
            key={i}
            x={i * bw + 1}
            y={h - bh}
            width={Math.max(bw - 2, 1)}
            height={bh}
            rx={2}
            fill={color}
            opacity={0.55 + 0.45 * (v / max)}
          />
        );
      })}
    </svg>
  );
}

// ── Circular arc gauge ────────────────────────────────────────────────────────
function ArcGauge({ label, val, col }: { label: string; val: number; col: string }) {
  const r = 26;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - Math.min(val, 100) / 100);
  const status = val >= 85 ? 'text-red-500' : val >= 65 ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle
          cx="34" cy="34" r={r}
          fill="none" stroke={col} strokeWidth="6"
          strokeDasharray={C} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="34" y="38" textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">
          {Number(val).toFixed(0)}%
        </text>
      </svg>
      <span className={`text-[11px] font-semibold ${status}`}>{label}</span>
    </div>
  );
}

// ── KPI Stats bar ─────────────────────────────────────────────────────────────
function StatsBar() {
  const { data: stats } = useSuspenseDashboardStats();
  const { data: ratioRaw } = useAttackRatio();

  const reqPerDay  = (stats?.traffic?.requestsPerSecond ?? 0) * 86400;
  const reqFmt     = stats?.traffic?.requestsPerDay ?? '0';
  const blockRate  = ratioRaw?.attackPercentage ?? 0;
  const doms       = stats?.domains?.total         ?? 0;
  const cpu        = stats?.system?.cpuUsage       ?? 0;
  const mem        = stats?.system?.memoryUsage    ?? 0;
  const alts       = stats?.alerts?.unacknowledged ?? 0;

  type Cell = {
    label: string; sub: string; val: number; dec: number; suf: string;
    col: string; display?: string;
  };

  const cells: Cell[] = [
    { label: 'Requests',   sub: 'Per day',    val: reqPerDay, dec: 0, suf: '', col: '#3b82f6', display: reqFmt },
    { label: 'Block Rate', sub: 'Attacks / 24h', val: blockRate, dec: 2, suf: '%', col: '#10b981' },
    { label: 'Domains',   sub: 'Protected',  val: doms,      dec: 0, suf: '', col: '#6366f1' },
    { label: 'CPU',        sub: 'Usage',      val: cpu,       dec: 1, suf: '%', col: cpu  >= 85 ? '#ef4444' : cpu  >= 65 ? '#f59e0b' : '#10b981' },
    { label: 'Memory',     sub: 'Usage',      val: mem,       dec: 1, suf: '%', col: mem  >= 85 ? '#ef4444' : mem  >= 65 ? '#f59e0b' : '#8b5cf6' },
    { label: 'Alert Rules', sub: 'Unacknowledged', val: alts, dec: 0, suf: '', col: alts > 0 ? '#ef4444' : '#94a3b8' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 bg-white border border-slate-100 rounded-xl overflow-hidden divide-x divide-slate-100">
      {cells.map(({ label, sub, val, dec, suf, col, display }) => (
        <div key={label} className="relative px-4 pt-3.5 pb-3 group hover:bg-slate-50/60 transition-colors">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t" style={{ backgroundColor: col }} />
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-black text-slate-800 leading-none tabular-nums">
              {display
                ? display
                : <><AnimatedNum value={val} dec={dec} />{suf}</>
              }
            </p>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Geo Location card ─────────────────────────────────────────────────────────
function GeoCard() {
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [mode, setMode] = useState<'requests' | 'blocked'>('requests');
  const { data: geoData } = useGeoStats(mode);

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-slate-700">Geo Location</span>
          <Dot />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border-b border-slate-200">
            {(['3d', '2d'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                  view === v ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >{v}</button>
            ))}
          </div>
          <div className="flex border-b border-slate-200">
            {([['requests','Requests'],['blocked','Blocked']] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                  mode === v
                    ? v === 'blocked' ? 'border-red-500 text-red-500' : 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        <div className="md:w-3/4 flex items-center justify-center">
          {view === '3d'
            ? <ThreeGlobe size={310} />
            : (
              <div className="w-full">
                <EChartsMap height={280} mode={mode} data={geoData ?? []} />
                <div className="mt-2 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Low</span>
                    <div
                      className="w-32 h-2.5 rounded-full"
                      style={{
                        background: mode === 'blocked'
                          ? 'linear-gradient(to right, #fff1f2, #fca5a5, #ef4444, #b91c1c)'
                          : 'linear-gradient(to right, #ecfeff, #67e8f9, #06b6d4, #0e7490)',
                      }}
                    />
                    <span className="text-[10px] text-slate-400 font-medium">High</span>
                  </div>
                  <p className="text-[10px] text-slate-300 tracking-wide">
                    {mode === 'blocked' ? 'Blocked intensity' : 'Traffic intensity'}
                  </p>
                </div>
              </div>
            )
          }
        </div>

        <div className="md:w-1/4 w-full md:pt-2">
          {(geoData ?? []).length > 0 ? (
            <div className="divide-y divide-slate-50">
              {(geoData ?? []).slice(0, 7).map((d: any, i: number) => {
                const fmtVal = d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : String(d.value);
                return (
                  <div key={d.name} className="flex items-center gap-2.5 py-2 px-1 hover:bg-slate-50/60 rounded transition-colors">
                    <span className="text-[10px] font-bold text-slate-300 w-4 flex-shrink-0 tabular-nums">#{i + 1}</span>
                    <span className="text-[12px] text-slate-600 flex-1 truncate">{d.name}</span>
                    <span className="text-[11px] font-bold tabular-nums"
                      style={{ color: mode === 'blocked' ? '#ef4444' : '#3b82f6' }}
                    >{fmtVal}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <Globe className="h-6 w-6 text-slate-200" />
              <p className="text-[11px] text-slate-300 text-center leading-relaxed">
                GeoIP analytics<br />requires nginx logs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Right column ──────────────────────────────────────────────────────────────
function RightColumn() {
  const { data: metrics   } = useSuspenseSystemMetrics("24h");
  const { data: stats     } = useSuspenseDashboardStats();
  const { data: trend     } = useSuspenseRequestTrend(300);
  const { data: modsec    } = useGlobalModSecSettings();
  const { data: crsRules  } = useCrsRules();

  const reqPts = (metrics?.requests ?? []).map((p: any) => Number(p.value) || 0);
  const blkPts = (trend ?? []).map((p: any) => Number(p.status403) || 0);

  const reqPeak = Math.max(...reqPts, 0);
  const blkPeak = Math.max(...blkPts, 0);
  const fmtPeak = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

  const cpuArr  = metrics?.cpu   ?? [];
  const memArr  = metrics?.memory ?? [];
  const cpuVal  = (cpuArr[cpuArr.length - 1]?.value   ?? stats?.system?.cpuUsage    ?? 0);
  const memVal  = (memArr[memArr.length - 1]?.value   ?? stats?.system?.memoryUsage ?? 0);
  const diskVal = stats?.system?.diskUsage ?? 0;

  const wafUptime    = stats?.uptimeDuration ?? '—';
  const wafMode      = modsec?.enabled === false ? 'Detection' : 'Prevention';
  const enabledRules = (crsRules ?? []).filter((r: any) => r.enabled !== false).length;
  const rulesLoaded  = enabledRules > 0 ? String(enabledRules) : '—';

  return (
    <div className="flex flex-col gap-4">
      {/* Requests — bar chart */}
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-sm font-semibold text-slate-700">Requests (24h)</p>
            <p className="text-[11px] text-slate-400">Incoming traffic</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-blue-500">{reqPeak > 0 ? fmtPeak(reqPeak) : '—'}</p>
            <p className="text-[10px] text-slate-400">peak/hr</p>
          </div>
        </div>
        <SparkBars pts={reqPts} color="#3b82f6" />
      </div>

      {/* Blocked — bar chart */}
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex justify-between items-start mb-1">
          <div>
            <p className="text-sm font-semibold text-slate-700">Blocked (24h)</p>
            <p className="text-[11px] text-slate-400">Threats intercepted</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-red-500">{blkPeak > 0 ? fmtPeak(blkPeak) : '—'}</p>
            <p className="text-[10px] text-slate-400">peak/interval</p>
          </div>
        </div>
        <SparkBars pts={blkPts.length > 0 ? blkPts : reqPts.map(() => 0)} color="#ef4444" />
      </div>

      {/* System health — arc gauges */}
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">System Health</p>
        <div className="flex justify-around">
          <ArcGauge label="CPU"    val={Number(cpuVal)}  col="#3b82f6" />
          <ArcGauge label="Memory" val={Number(memVal)}  col="#8b5cf6" />
          <ArcGauge label="Disk"   val={Number(diskVal)} col="#f59e0b" />
        </div>
      </div>

      {/* WAF Engine status */}
      <div className="relative bg-white border border-slate-100 rounded-xl p-4 flex-1 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t bg-emerald-500" />
        <div className="flex items-center gap-2 mb-3 mt-0.5">
          <p className="text-sm font-semibold text-slate-700 flex-1">WAF Engine</p>
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Running
          </span>
        </div>
        <div className="divide-y divide-slate-50">
          {([
            { label: 'Mode',              val: wafMode,      hi: wafMode === 'Prevention' },
            { label: 'Uptime',            val: wafUptime,    hi: false },
            { label: 'CRS Rules Loaded',  val: rulesLoaded,  hi: false },
            { label: 'Paranoia Level',    val: 'PL1',        hi: false },
            { label: 'Request Body',      val: 'Inspection On',  hi: true  },
            { label: 'Response Body',     val: 'Inspection On',  hi: true  },
          ] as { label: string; val: string; hi: boolean }[]).map(({ label, val, hi }) => (
            <div key={label} className="flex items-center justify-between py-1.5">
              <span className="text-[10px] text-slate-400">{label}</span>
              <span className={`text-[11px] font-semibold tabular-nums ${hi ? 'text-emerald-600' : 'text-slate-700'}`}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Time-ago helper ───────────────────────────────────────────────────────────
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Severity map ──────────────────────────────────────────────────────────────
const SEV_META: Record<string, { dot: string; label: string }> = {
  critical: { dot: '#ef4444', label: 'CRIT' },
  high:     { dot: '#f97316', label: 'HIGH' },
  medium:   { dot: '#f59e0b', label: 'MED'  },
  low:      { dot: '#94a3b8', label: 'LOW'  },
  info:     { dot: '#3b82f6', label: 'INFO' },
  CRITICAL: { dot: '#ef4444', label: 'CRIT' },
  HIGH:     { dot: '#f97316', label: 'HIGH' },
  MEDIUM:   { dot: '#f59e0b', label: 'MED'  },
  LOW:      { dot: '#94a3b8', label: 'LOW'  },
  WARNING:  { dot: '#f59e0b', label: 'WARN' },
};

// ── Time range helper ─────────────────────────────────────────────────────────
const TR_OPTS = ['1h','6h','24h','7d'] as const;
type TR = typeof TR_OPTS[number];
const TR_LABEL: Record<TR, string> = {
  '1h': 'Last 1h', '6h': 'Last 6h', '24h': 'Last 24h', '7d': 'Last 7 days',
};
const TR_HOURS: Record<TR, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };

// ── Security Events — real data ───────────────────────────────────────────────
function EventsCard({ tr }: { tr: TR }) {
  const hours   = TR_HOURS[tr];
  const { data: events } = useSuspenseLatestNews(50, hours);
  const filtered = events ?? [];

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-slate-700">Security Events</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{filtered.length} events</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <span className="text-[12px] text-slate-300">No events detected in {TR_LABEL[tr].toLowerCase()}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[28px_1fr_auto_44px] items-center gap-x-2 pb-1.5 mb-0.5 border-b border-slate-100">
            <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-widest">SEV</span>
            <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-widest">Event</span>
            <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-widest">Source IP</span>
            <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-widest text-right">When</span>
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.slice(0, 8).map((e: any, i: number) => {
              const m = SEV_META[e.severity ?? 'info'] ?? SEV_META['info'] ?? { dot: '#94a3b8', label: 'INFO' };
              return (
                <div key={e.id ?? i}
                  className="grid grid-cols-[28px_1fr_auto_44px] items-center gap-x-2 py-[7px] px-1 rounded hover:bg-slate-50/60 transition-colors"
                >
                  <span
                    className="text-[8px] font-black tracking-wider px-1 py-0.5 rounded text-center"
                    style={{ backgroundColor: `${m.dot}18`, color: m.dot }}
                  >{m.label}</span>
                  <span className="text-[12px] font-medium text-slate-700 truncate">{e.attackType ?? 'Security Event'}</span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">{e.attackerIp ?? '—'}</span>
                  <span className="text-[10px] text-slate-300 text-right tabular-nums">{timeAgo(e.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Attack breakdown — real data ──────────────────────────────────────────────
const ATK_COLORS = ['#6366f1','#3b82f6','#0ea5e9','#06b6d4','#14b8a6'];

function AttacksCard({ tr }: { tr: TR }) {
  const hours = TR_HOURS[tr];
  const { data: attacks } = useSuspenseLatestAttackStats(10, hours);

  const fmtN = (n: number) => n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'k' : String(n);
  const total = (attacks ?? []).reduce((s: number, a: any) => s + (a.count ?? 0), 0);
  const atkLabel = TR_LABEL[tr];

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-700">Attack Types</span>
        </div>
        <span className="text-[11px] text-slate-400">
          {atkLabel} · Total <strong className="text-slate-600">{fmtN(total)}</strong>
        </span>
      </div>

      {!attacks || attacks.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-[12px] text-slate-300">No attacks detected in the last 24h</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {attacks.map((a: any, i: number) => {
            const col      = ATK_COLORS[i % ATK_COLORS.length];
            const sharePct = total > 0 ? Math.round((a.count / total) * 100) : 0;
            const barPct   = total > 0 ? (a.count / total) * 100 : 0;
            return (
              <div key={a.attackType ?? i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: col }} />
                    <span className="text-[12px] font-medium text-slate-600">{a.attackType}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-slate-400">{sharePct}%</span>
                    <span className="text-[12px] font-bold text-slate-700 w-12 text-right">{fmtN(a.count)}</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-700"
                    style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${col}cc, ${col})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function DashboardNew() {
  const [tr, setTr] = useState<TR>('24h');

  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="h-[76px] bg-white border border-slate-100 rounded-xl animate-pulse" />}>
        <StatsBar />
      </Suspense>

      <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-4">
        <div className="space-y-4">
          <GeoCard />

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Threat Analysis</span>
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {TR_OPTS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setTr(opt)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    tr === opt
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Suspense fallback={<div className="h-48 bg-white border border-slate-100 rounded-xl animate-pulse" />}>
              <EventsCard tr={tr} />
            </Suspense>
            <Suspense fallback={<div className="h-48 bg-white border border-slate-100 rounded-xl animate-pulse" />}>
              <AttacksCard tr={tr} />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-36 bg-white border border-slate-100 rounded-xl animate-pulse" />)}
        </div>}>
          <RightColumn />
        </Suspense>
      </div>
    </div>
  );
}
