import { useSuspenseSSLCertificates } from '@/queries/ssl.query-options';
import { ShieldX, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

interface SSLStatsProps {
  onAdd: () => void;
}

export function SSLStats({ onAdd }: SSLStatsProps) {
  const { data: certificates } = useSuspenseSSLCertificates();

  const total    = certificates.length;
  const valid    = certificates.filter(c => c.status === 'valid').length;
  const expiring = certificates.filter(c => c.status === 'expiring').length;
  const expired  = certificates.filter(c => c.status === 'expired').length;

  const banner = (() => {
    if (total === 0) return {
      icon: ShieldX,
      bg:   'bg-red-50 border-red-200',
      iconCls: 'text-red-400',
      tag:  { text: 'Critical', cls: 'bg-red-100 text-red-600' },
      title: 'TLS Protection Offline',
      desc:  'No certificates installed. All domains are serving traffic over unencrypted HTTP connections.',
      action: { label: 'Issue Certificate Now' },
    };
    if (expired > 0) return {
      icon: ShieldAlert,
      bg:   'bg-red-50 border-red-200',
      iconCls: 'text-red-400',
      tag:  { text: 'Critical', cls: 'bg-red-100 text-red-600' },
      title: `${expired} certificate${expired > 1 ? 's' : ''} expired`,
      desc:  'Expired certificates are no longer trusted by browsers. Affected domains may show security warnings.',
      action: { label: 'Renew Expired Now' },
    };
    if (expiring > 0) return {
      icon: AlertTriangle,
      bg:   'bg-amber-50 border-amber-200',
      iconCls: 'text-amber-400',
      tag:  { text: 'Warning', cls: 'bg-amber-100 text-amber-700' },
      title: `${expiring} certificate${expiring > 1 ? 's' : ''} expiring within 30 days`,
      desc:  "Schedule renewal soon to avoid service interruption. Auto-renew is available for Let's Encrypt and ZeroSSL.",
      action: { label: 'Review Expiring' },
    };
    return null;
  })();

  return (
    <div className="space-y-3">
      {banner && (() => {
        const Icon = banner.icon;
        return (
          <div className={`flex items-center gap-4 px-4 py-3 border rounded-lg ${banner.bg}`}>
            <Icon className={`h-4 w-4 flex-shrink-0 ${banner.iconCls}`} />
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${banner.tag.cls}`}>
                {banner.tag.text}
              </span>
              <span className="text-[13px] font-semibold text-slate-800">{banner.title}</span>
              <span className="text-[12px] text-slate-500 hidden sm:inline">&mdash; {banner.desc}</span>
            </div>
            {total === 0 && (
              <button
                onClick={onAdd}
                className="flex-shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-sm">
                {banner.action.label}
              </button>
            )}
          </div>
        );
      })()}

      {/* Stats strip */}
      <div className="grid grid-cols-4 border border-slate-100 rounded-lg bg-white divide-x divide-slate-100 overflow-hidden">

        <div className="flex flex-col px-5 py-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
          <span className="text-2xl font-bold tabular-nums text-slate-700 mt-1">{total}</span>
          <span className="text-[11px] text-slate-400 mt-0.5">certificates</span>
        </div>

        <div className="flex flex-col px-5 py-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Valid</span>
          </div>
          <span className={`text-2xl font-bold tabular-nums mt-1 ${valid > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{valid}</span>
          <span className={`text-[11px] mt-0.5 ${valid > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
            {valid > 0 ? 'protected' : 'none'}
          </span>
        </div>

        <div className={`flex flex-col px-5 py-4 ${expiring > 0 ? 'bg-amber-50/50' : ''}`}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className={`h-3 w-3 ${expiring > 0 ? 'text-amber-400' : 'text-slate-300'}`} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expiring Soon</span>
          </div>
          <span className={`text-2xl font-bold tabular-nums mt-1 ${expiring > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{expiring}</span>
          <span className={`text-[11px] mt-0.5 font-medium ${expiring > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
            {expiring > 0 ? 'action needed' : 'none'}
          </span>
        </div>

        <div className={`flex flex-col px-5 py-4 ${expired > 0 ? 'bg-red-50/50' : ''}`}>
          <div className="flex items-center gap-1.5">
            <ShieldX className={`h-3 w-3 ${expired > 0 ? 'text-red-400' : 'text-slate-300'}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${expired > 0 ? 'text-red-400' : 'text-slate-400'}`}>Expired</span>
          </div>
          <span className={`text-2xl font-bold tabular-nums mt-1 ${expired > 0 ? 'text-red-600' : 'text-slate-300'}`}>{expired}</span>
          <span className={`text-[11px] mt-0.5 font-semibold ${expired > 0 ? 'text-red-500' : 'text-slate-300'}`}>
            {expired > 0 ? 'renew immediately' : 'none'}
          </span>
        </div>

      </div>
    </div>
  );
}
