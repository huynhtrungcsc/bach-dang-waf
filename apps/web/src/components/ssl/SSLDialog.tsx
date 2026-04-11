import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Domain } from '@/types';
import { toast } from 'sonner';
import { useIssueAutoSSL, useUploadManualSSL, useDomains } from '@/queries';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SSLDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SSLDialog({ open, onOpenChange, onSuccess }: SSLDialogProps) {
  const [method, setMethod] = useState<'auto' | 'manual'>('auto');
  const [formData, setFormData] = useState({
    domainId: '',
    email: '',
    autoRenew: true,
    certificate: '',
    privateKey: '',
    chain: '',
  });

  const { data: domainsResponse, isLoading: domainsLoading, error: domainsError } = useDomains();
  const domainsWithoutSSL = domainsResponse?.data?.filter(d => !d.sslCertificate && !d.sslEnabled) || [];

  const issueAutoSSL = useIssueAutoSSL();
  const uploadManualSSL = useUploadManualSSL();
  const isPending = issueAutoSSL.isPending || uploadManualSSL.isPending;

  useEffect(() => {
    if (domainsError) toast.error('Failed to load domain list');
  }, [domainsError]);

  const validateCertificate = (cert: string, type: 'certificate' | 'privateKey' | 'chain'): { valid: boolean; error?: string } => {
    if (!cert.trim()) return { valid: false, error: `${type} is empty` };
    const patterns = {
      certificate: { begin: '-----BEGIN CERTIFICATE-----', end: '-----END CERTIFICATE-----', name: 'Certificate' },
      privateKey: { begin: /-----BEGIN (RSA |EC |ENCRYPTED )?PRIVATE KEY-----/, end: /-----END (RSA |EC |ENCRYPTED )?PRIVATE KEY-----/, name: 'Private Key' },
      chain: { begin: '-----BEGIN CERTIFICATE-----', end: '-----END CERTIFICATE-----', name: 'Certificate Chain' },
    };
    const pattern = patterns[type];
    const hasBegin = pattern.begin instanceof RegExp ? pattern.begin.test(cert) : cert.includes(pattern.begin as string);
    if (!hasBegin) return { valid: false, error: `${pattern.name} must begin with a valid PEM header` };
    const hasEnd = pattern.end instanceof RegExp ? pattern.end.test(cert) : cert.includes(pattern.end as string);
    if (!hasEnd) return { valid: false, error: `${pattern.name} must end with a valid PEM footer` };
    const suspicious = [/<script/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i, /eval\(/i, /document\./i, /window\./i];
    for (const s of suspicious) {
      if (s.test(cert)) return { valid: false, error: `${pattern.name} contains disallowed content` };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.domainId) { toast.error('Select a target domain'); return; }

    if (method === 'manual') {
      if (!formData.certificate || !formData.privateKey) { toast.error('X.509 certificate and private key are required'); return; }
      const certV = validateCertificate(formData.certificate, 'certificate');
      if (!certV.valid) { toast.error(certV.error || 'Invalid certificate PEM'); return; }
      const keyV = validateCertificate(formData.privateKey, 'privateKey');
      if (!keyV.valid) { toast.error(keyV.error || 'Invalid private key PEM'); return; }
      if (formData.chain?.trim()) {
        const chainV = validateCertificate(formData.chain, 'chain');
        if (!chainV.valid) { toast.error(chainV.error || 'Invalid chain PEM'); return; }
      }
    }

    try {
      if (method === 'auto') {
        await issueAutoSSL.mutateAsync({ domainId: formData.domainId, email: formData.email || undefined, autoRenew: formData.autoRenew });
        toast.success('TLS certificate provisioned via ACME');
      } else {
        await uploadManualSSL.mutateAsync({ domainId: formData.domainId, certificate: formData.certificate, privateKey: formData.privateKey, chain: formData.chain || undefined });
        toast.success('TLS certificate imported successfully');
      }
      onSuccess();
      onOpenChange(false);
      setFormData({ domainId: '', email: '', autoRenew: true, certificate: '', privateKey: '', chain: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Certificate provisioning failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            Provision TLS Certificate
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Associate a TLS/SSL certificate with a protected domain via ACME auto-provisioning or manual PEM import.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Target Domain — full width */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] font-medium">
              Target Domain <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.domainId}
              onValueChange={(value) => setFormData({ ...formData, domainId: value })}
              disabled={domainsLoading || isPending}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder={domainsLoading ? 'Loading protected domains…' : 'Select a protected domain'} />
              </SelectTrigger>
              <SelectContent>
                {domainsWithoutSSL.length === 0 ? (
                  <SelectItem value="none" disabled>All domains already have TLS configured</SelectItem>
                ) : (
                  domainsWithoutSSL.map((domain: Domain) => (
                    <SelectItem key={domain.id} value={domain.id}>{domain.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">Protected domain to associate this certificate with</p>
          </div>

          {/* Provisioning Method Tabs */}
          <Tabs value={method} onValueChange={(v) => setMethod(v as 'auto' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="auto" className="text-[12px]">ACME Auto-Provision</TabsTrigger>
              <TabsTrigger value="manual" className="text-[12px]">Manual PEM Import</TabsTrigger>
            </TabsList>

            {/* ── AUTO TAB ── */}
            <TabsContent value="auto" className="mt-4">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                {/* LEFT: Email + Auto-Renewal */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">
                      ACME Notification Email <span className="font-normal text-slate-400">(optional)</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="ops@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isPending}
                      className="h-9 text-[13px]"
                    />
                    <p className="text-[11px] text-slate-400">Expiry notifications and ACME account registration</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">Auto-Renewal Policy</Label>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-slate-700">Automatic renewal</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Re-issue certificate before expiry deadline</p>
                      </div>
                      <Switch
                        checked={formData.autoRenew}
                        onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
                        disabled={isPending}
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT: Protocol info + Requirements */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3.5">
                    <p className="text-[12px] font-semibold text-blue-800 mb-1">ACME Protocol — ZeroSSL / Let's Encrypt</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Certificates are automatically issued and renewed via the ACME protocol.
                      Domain ownership is verified using HTTP-01 challenge on port 80.
                      Validity period: 90 days, renewed automatically 30 days before expiry.
                    </p>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                    <p className="text-[12px] font-semibold text-slate-700 mb-2">Pre-Provisioning Requirements</p>
                    <ul className="space-y-1.5">
                      {[
                        'Domain DNS must resolve to this WAF node\'s public IP',
                        'TCP port 80 must be reachable for HTTP-01 ACME challenge',
                        'Fully-qualified domain name required (wildcard not supported)',
                      ].map((req) => (
                        <li key={req} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                          <span className="text-[11px] text-slate-500">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── MANUAL TAB ── */}
            <TabsContent value="manual" className="mt-4 space-y-4">
              {/* Top 2-column: cert + key */}
              <div className="grid grid-cols-2 gap-x-5">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">
                    X.509 Certificate <span className="text-red-500">*</span>
                    <span className="font-normal text-slate-400 ml-1">(PEM)</span>
                  </Label>
                  <Textarea
                    placeholder={"-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"}
                    value={formData.certificate}
                    onChange={(e) => setFormData({ ...formData, certificate: e.target.value })}
                    rows={7}
                    className="font-mono text-[11px] resize-none"
                    required={method === 'manual'}
                    disabled={isPending}
                  />
                  <p className="text-[11px] text-slate-400">End-entity certificate issued by your CA</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">
                    Private Key <span className="text-red-500">*</span>
                    <span className="font-normal text-slate-400 ml-1">(PEM — RSA / EC / PKCS#8)</span>
                  </Label>
                  <Textarea
                    placeholder={"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"}
                    value={formData.privateKey}
                    onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                    rows={7}
                    className="font-mono text-[11px] resize-none"
                    required={method === 'manual'}
                    disabled={isPending}
                  />
                  <p className="text-[11px] text-slate-400">Corresponds to the public key in the certificate</p>
                </div>
              </div>

              {/* Full-width: chain */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-medium">
                  Intermediate Chain <span className="font-normal text-slate-400">(optional — PEM)</span>
                </Label>
                <Textarea
                  placeholder={"-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"}
                  value={formData.chain}
                  onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                  rows={4}
                  className="font-mono text-[11px] resize-none"
                  disabled={isPending}
                />
                <p className="text-[11px] text-slate-400">CA intermediate certificates to complete the trust chain (ordered, leaf-to-root)</p>
              </div>

              {/* Security notice */}
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700">
                  Private key material is encrypted at rest and never exposed in API responses.
                  Ensure you are importing on a secure, trusted connection.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="text-[13px]" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-[13px]" disabled={isPending}>
              {isPending
                ? (method === 'auto' ? 'Provisioning…' : 'Importing…')
                : (method === 'auto' ? 'Provision Certificate' : 'Import Certificate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
