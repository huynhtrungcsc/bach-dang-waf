import { useState, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { SSLDialog } from '@/components/ssl/SSLDialog';
import { SSLStats } from './SSLStats';
import { SSLTable } from './SSLTable';
import { SkeletonTable } from '@/components/ui/skeletons';
import { sslQueryKeys, useSuspenseSSLCertificates } from '@/queries/ssl.query-options';

/* ─────────────────────────────────────────────────────
   CASE 3: Has certificates → show "Add Certificate" button.
   CASE 1 (0 certs, CRITICAL) → return null; banner owns the CTA.
   Wrapped in Suspense by the parent.
───────────────────────────────────────────────────── */
function SSLAddButton({ onAdd }: { onAdd: () => void }) {
  const { data: certs } = useSuspenseSSLCertificates();
  if (certs.length === 0) return null;
  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors">
      <Plus className="h-3.5 w-3.5" />
      Issue Certificate
    </button>
  );
}

export default function SSL() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const onAdd = () => setDialogOpen(true);

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-slate-800">SSL / TLS Certificates</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Manage certificates protecting your domains — Let&apos;s Encrypt, ZeroSSL and manual upload
          </p>
        </div>
        {/* Button only shown when certs exist (state-driven) */}
        <Suspense fallback={<div className="h-8 w-36 bg-slate-100 animate-pulse rounded-md" />}>
          <SSLAddButton onAdd={onAdd} />
        </Suspense>
      </div>

      <SSLDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: sslQueryKeys.lists() })}
      />

      {/* ── Status banner + Stats strip ── */}
      <Suspense fallback={
        <div className="border border-slate-200 rounded-lg bg-white h-16 animate-pulse" />
      }>
        <SSLStats onAdd={onAdd} />
      </Suspense>

      {/* ── Certificate table ── */}
      <Suspense fallback={<SkeletonTable rows={5} columns={7} title="SSL Certificates" />}>
        <SSLTable onAdd={onAdd} />
      </Suspense>

    </div>
  );
}
