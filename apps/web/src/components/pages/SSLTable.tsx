import { useState } from 'react';
import { useSuspenseSSLCertificates } from '@/queries/ssl.query-options';
import { useRenewSSLCertificate, useDeleteSSLCertificate } from '@/queries/ssl.query-options';
import { RefreshCw, Trash2, Search, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/* ─── helpers ─── */
function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function StatusCell({ status }: { status: string }) {
  const map: Record<string, { Icon: React.ElementType; dot: string; text: string; label: string }> = {
    valid:    { Icon: ShieldCheck,  dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Valid'    },
    expiring: { Icon: ShieldAlert,  dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Expiring' },
    expired:  { Icon: ShieldX,      dot: 'bg-red-500',     text: 'text-red-700',     label: 'Expired'  },
  };
  const { Icon: _Icon, dot, text, label } = (map[status] ?? map['valid']) as { Icon: React.ElementType; dot: string; text: string; label: string };
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${text}`}>
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  );
}

function DaysLeft({ days }: { days?: number }) {
  if (days === undefined) return <span className="text-slate-400 text-[13px]">—</span>;
  const cls =
    days <= 0  ? 'text-red-600 font-bold'     :
    days <= 14 ? 'text-red-500 font-semibold' :
    days <= 30 ? 'text-amber-600 font-semibold' :
    days <= 60 ? 'text-yellow-700'             :
                 'text-slate-500';
  const label = days <= 0 ? 'Expired' : `${days}d`;
  return <span className={`text-[13px] tabular-nums ${cls}`}>{label}</span>;
}

/* ─── operational empty state ─── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
        <ShieldX className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-[13px] font-semibold text-slate-700">No certificates installed</p>
      <p className="text-[12px] text-slate-400 mt-1 max-w-sm leading-relaxed">
        HTTPS is not configured for any domain. Issue a free certificate via Let&apos;s Encrypt or upload a manual one.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors">
        Issue Certificate
      </button>
    </div>
  );
}

/* ─── main ─── */
interface SSLTableProps {
  onAdd: () => void;
}

export function SSLTable({ onAdd }: SSLTableProps) {
  const [renewingId, setRenewingId]   = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const { data: certificates }        = useSuspenseSSLCertificates();
  const renewMutation                 = useRenewSSLCertificate();
  const deleteMutation                = useDeleteSSLCertificate();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const filtered = certificates.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      (c.domain?.name || c.commonName).toLowerCase().includes(q) ||
      (c.issuer || '').toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q);
  });

  const handleRenew = async (id: string, days?: number) => {
    if (days !== undefined && days > 30) {
      toast.warning(`Renewal available when less than 30 days remain (currently ${days}d).`);
      return;
    }
    try {
      setRenewingId(id);
      await renewMutation.mutateAsync(id);
      toast.success('Certificate renewed and applied.');
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Failed to renew certificate';
      msg.includes('eligible') ? toast.warning(msg) : toast.error(msg);
    } finally {
      setRenewingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Certificate',
      description: `Delete the certificate for "${name}"? This cannot be undone and will disable HTTPS for this domain.`,
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(id);
          toast.success('Certificate deleted.');
          setConfirmDialog(p => ({ ...p, open: false }));
        } catch (e: any) {
          toast.error(e.response?.data?.message || 'Failed to delete.');
        }
      },
    });
  };

  const isAcme = (issuer: string) =>
    issuer === "Let's Encrypt" || issuer === 'ZeroSSL';

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">

      {certificates.length === 0 ? (
        <EmptyState onAdd={onAdd} />
      ) : (
        <>
          {/* toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter domain, issuer, status…"
                className="h-8 pl-8 pr-3 text-[12px] border border-slate-200 rounded bg-white w-60 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="text-[12px] text-slate-400 hover:text-slate-600">
                Clear
              </button>
            )}
            <span className="ml-auto text-[12px] text-slate-400 tabular-nums">
              {filtered.length} of {certificates.length} cert{certificates.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[13px] text-slate-500">No results for &ldquo;{search}&rdquo;.</p>
              <button onClick={() => setSearch('')} className="mt-1 text-[12px] text-primary hover:underline">
                Clear filter
              </button>
            </div>
          ) : (
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  {[
                    { h: 'Domain / CN', w: '' },
                    { h: 'Issuer',      w: 'w-36' },
                    { h: 'Valid From',  w: 'w-32' },
                    { h: 'Expires',     w: 'w-32' },
                    { h: 'Days Left',   w: 'w-24' },
                    { h: 'Auto Renew',  w: 'w-28' },
                    { h: 'Status',      w: 'w-28' },
                    { h: '',            w: 'w-32' },
                  ].map(({ h, w }) => (
                    <th key={h} className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${w}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert, i) => {
                  const name = cert.domain?.name || cert.commonName;
                  const isExpired  = cert.status === 'expired';
                  const isExpiring = cert.status === 'expiring';
                  const rowBg =
                    isExpired  ? 'bg-red-50/40 hover:bg-red-50/60' :
                    isExpiring ? 'bg-amber-50/30 hover:bg-amber-50/50' :
                    i % 2 === 0 ? 'hover:bg-slate-50/50' : 'bg-slate-50/20 hover:bg-slate-50/50';

                  return (
                    <tr
                      key={cert.id}
                      className={`border-b border-slate-50 last:border-0 transition-colors ${rowBg}`}>

                      {/* domain */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800">{name}</span>
                        {cert.sans?.length > 0 && (
                          <span className="ml-2 text-[11px] text-slate-400">+{cert.sans.length} SAN</span>
                        )}
                      </td>

                      {/* issuer */}
                      <td className="px-4 py-3.5">
                        <span className={isAcme(cert.issuer) ? 'text-primary font-medium' : 'text-slate-500'}>
                          {cert.issuer || '—'}
                        </span>
                      </td>

                      {/* valid from */}
                      <td className="px-4 py-3.5 text-slate-500 tabular-nums whitespace-nowrap">
                        {fmt(cert.validFrom)}
                      </td>

                      {/* expires */}
                      <td className="px-4 py-3.5 tabular-nums whitespace-nowrap">
                        <span className={isExpired ? 'text-red-600 font-medium' : isExpiring ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                          {fmt(cert.validTo)}
                        </span>
                      </td>

                      {/* days left */}
                      <td className="px-4 py-3.5">
                        <DaysLeft days={cert.daysUntilExpiry} />
                      </td>

                      {/* auto renew */}
                      <td className="px-4 py-3.5">
                        {cert.autoRenew
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Auto</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">Manual</span>
                        }
                      </td>

                      {/* status */}
                      <td className="px-4 py-3.5">
                        <StatusCell status={cert.status} />
                      </td>

                      {/* actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 justify-end">
                          {isAcme(cert.issuer) && (
                            <button
                              onClick={() => handleRenew(cert.id, cert.daysUntilExpiry)}
                              disabled={renewingId === cert.id}
                              title={cert.daysUntilExpiry !== undefined && cert.daysUntilExpiry > 30
                                ? `Available in ${cert.daysUntilExpiry - 30}d`
                                : 'Renew certificate'}
                              className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-primary disabled:opacity-40 transition-colors">
                              <RefreshCw className={`h-3.5 w-3.5 ${renewingId === cert.id ? 'animate-spin' : ''}`} />
                              {renewingId === cert.id ? 'Renewing…' : 'Renew'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(cert.id, name)}
                            className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={open => setConfirmDialog(p => ({ ...p, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
