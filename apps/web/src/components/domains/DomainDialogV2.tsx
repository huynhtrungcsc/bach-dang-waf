import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus, Trash2, HelpCircle, Shield, Server, Settings,
  Globe, Lock, Activity, Cpu, Network, FileCode,
} from 'lucide-react';
import { Domain } from '@/types';
import { toast } from 'sonner';

interface UpstreamFormData {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  sslVerify: boolean;
  weight: number;
  maxFails: number;
  failTimeout: number;
}

interface CustomLocationFormData {
  path: string;
  upstreamType: 'proxy_pass' | 'grpc_pass' | 'grpcs_pass';
  upstreams: UpstreamFormData[];
  config?: string;
}

interface FormData {
  name: string;
  status: 'active' | 'inactive' | 'error';
  lbAlgorithm: 'round_robin' | 'least_conn' | 'ip_hash';
  upstreams: UpstreamFormData[];
  modsecEnabled: boolean;
  autoCreateSSL: boolean;
  sslEmail: string;
  realIpEnabled: boolean;
  realIpCloudflare: boolean;
  healthCheckEnabled: boolean;
  healthCheckPath: string;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  hstsEnabled: boolean;
  http2Enabled: boolean;
  grpcEnabled: boolean;
  clientMaxBodySize: number;
  customLocations: CustomLocationFormData[];
}

interface DomainDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: Domain | null;
  onSave: (domain: any) => void;
  isLoading?: boolean;
}

/* ─── small helpers ─── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </div>
  );
}

function ToggleRow({
  id, label, description, children,
}: {
  id?: string; label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-slate-700 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ColPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}

function ColDivider() {
  return <div className="w-px bg-slate-100 self-stretch mx-1 flex-shrink-0" />;
}

export function DomainDialogV2({ open, onOpenChange, domain, onSave, isLoading = false }: DomainDialogV2Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      status: 'active',
      lbAlgorithm: 'round_robin',
      upstreams: [{ host: '', port: 80, protocol: 'http', sslVerify: true, weight: 1, maxFails: 3, failTimeout: 30 }],
      modsecEnabled: true,
      autoCreateSSL: false,
      sslEmail: '',
      realIpEnabled: false,
      realIpCloudflare: false,
      healthCheckEnabled: true,
      healthCheckPath: '/health',
      healthCheckInterval: 30,
      healthCheckTimeout: 5,
      hstsEnabled: false,
      http2Enabled: true,
      grpcEnabled: false,
      clientMaxBodySize: 100,
      customLocations: [],
    },
  });

  const { fields: upstreamFields, append: appendUpstream, remove: removeUpstream } = useFieldArray({
    control,
    name: 'upstreams',
  });

  const { fields: locationFields, append: appendLocation, remove: removeLocation } = useFieldArray({
    control,
    name: 'customLocations',
  });

  const realIpEnabled = watch('realIpEnabled');
  const autoCreateSSL = watch('autoCreateSSL');
  const healthCheckEnabled = watch('healthCheckEnabled');

  useEffect(() => {
    if (open) {
      if (domain) {
        reset({
          name: domain.name || '',
          status: domain.status || 'active',
          lbAlgorithm: (domain.loadBalancer?.algorithm || 'round_robin') as any,
          upstreams: domain.upstreams && domain.upstreams.length > 0
            ? domain.upstreams.map(u => ({
                host: u.host,
                port: u.port,
                protocol: (u.protocol || 'http') as 'http' | 'https',
                sslVerify: u.sslVerify !== undefined ? u.sslVerify : true,
                weight: u.weight || 1,
                maxFails: u.maxFails || 3,
                failTimeout: u.failTimeout || 30,
              }))
            : [{ host: '', port: 80, protocol: 'http', sslVerify: true, weight: 1, maxFails: 3, failTimeout: 30 }],
          modsecEnabled: domain.modsecEnabled !== undefined ? domain.modsecEnabled : true,
          realIpEnabled: (domain as any).realIpEnabled || false,
          realIpCloudflare: (domain as any).realIpCloudflare || false,
          healthCheckEnabled: domain.loadBalancer?.healthCheckEnabled !== undefined ? domain.loadBalancer.healthCheckEnabled : true,
          healthCheckPath: domain.loadBalancer?.healthCheckPath || '/health',
          healthCheckInterval: domain.loadBalancer?.healthCheckInterval || 30,
          healthCheckTimeout: domain.loadBalancer?.healthCheckTimeout || 5,
          hstsEnabled: (domain as any).hstsEnabled || false,
          http2Enabled: (domain as any).http2Enabled !== undefined ? (domain as any).http2Enabled : true,
          grpcEnabled: (domain as any).grpcEnabled || false,
          clientMaxBodySize: (domain as any).clientMaxBodySize || 100,
          customLocations: (domain as any).customLocations || [],
        });
      } else {
        reset({
          name: '',
          status: 'active',
          lbAlgorithm: 'round_robin',
          upstreams: [{ host: '', port: 80, protocol: 'http', sslVerify: true, weight: 1, maxFails: 3, failTimeout: 30 }],
          modsecEnabled: true,
          autoCreateSSL: false,
          sslEmail: '',
          realIpEnabled: false,
          realIpCloudflare: false,
          healthCheckEnabled: true,
          healthCheckPath: '/health',
          healthCheckInterval: 30,
          healthCheckTimeout: 5,
          hstsEnabled: false,
          http2Enabled: true,
          grpcEnabled: false,
          clientMaxBodySize: 100,
          customLocations: [],
        });
      }
    }
  }, [open, domain, reset]);

  const onSubmit = (data: FormData) => {
    if (!data.name) { toast.error('Hostname is required'); return; }
    if (data.upstreams.length === 0 || !data.upstreams.some(u => u.host)) {
      toast.error('At least one valid origin server is required'); return;
    }
    if (data.autoCreateSSL && !data.sslEmail) {
      toast.error('Email is required when auto-creating SSL certificate'); return;
    }

    const domainData: any = {
      name: data.name,
      status: data.status,
      modsecEnabled: data.modsecEnabled,
      upstreams: data.upstreams.filter(u => u.host).map(u => ({
        host: u.host, port: Number(u.port), protocol: u.protocol, sslVerify: u.sslVerify,
        weight: Number(u.weight), maxFails: Number(u.maxFails), failTimeout: Number(u.failTimeout),
      })),
      loadBalancer: {
        algorithm: data.lbAlgorithm,
        healthCheckEnabled: data.healthCheckEnabled,
        healthCheckInterval: Number(data.healthCheckInterval),
        healthCheckTimeout: Number(data.healthCheckTimeout),
        healthCheckPath: data.healthCheckPath,
      },
      realIpConfig: {
        realIpEnabled: data.realIpEnabled,
        realIpCloudflare: data.realIpCloudflare,
        realIpCustomCidrs: [],
      },
      advancedConfig: {
        hstsEnabled: data.hstsEnabled,
        http2Enabled: data.http2Enabled,
        grpcEnabled: data.grpcEnabled,
        clientMaxBodySize: Number(data.clientMaxBodySize),
        customLocations: data.customLocations.filter(loc => loc.path && loc.upstreams.length > 0),
      },
    };

    if (!domain && data.autoCreateSSL) {
      domainData.autoCreateSSL = true;
      domainData.sslEmail = data.sslEmail;
    }

    onSave(domainData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle className="text-base font-semibold">
            {domain ? 'Edit Protected Site' : 'Add Protected Site'}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Define a reverse proxy entry point with load balancing, WAF enforcement, and TLS termination.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-2">
          <Tabs defaultValue="basic" className="w-full">
            {/* Tab bar */}
            <TabsList className="h-9 bg-slate-100 p-0.5 rounded-lg w-full grid grid-cols-3">
              <TabsTrigger value="basic" className="h-8 text-[12px] gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                <Server className="h-3.5 w-3.5" /> Basic
              </TabsTrigger>
              <TabsTrigger value="security" className="h-8 text-[12px] gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                <Shield className="h-3.5 w-3.5" /> Security
              </TabsTrigger>
              <TabsTrigger value="advanced" className="h-8 text-[12px] gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                <Settings className="h-3.5 w-3.5" /> Advanced
              </TabsTrigger>
            </TabsList>

            {/* ══════════════════════════════════════
                TAB 1 — BASIC
                Left: site identity | Right: origin servers
            ══════════════════════════════════════ */}
            <TabsContent value="basic" className="mt-4">
              <div className="flex gap-0 min-h-[420px]">

                {/* ── Left column: site identity ── */}
                <ColPanel className="w-[42%] pr-6">
                  <SectionTitle>Site Identity</SectionTitle>

                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-medium">
                      Hostname <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        {...register('name', { required: 'Hostname is required' })}
                        placeholder="example.com"
                        disabled={isLoading}
                        className="pl-8 h-9 text-[13px]"
                      />
                    </div>
                    {errors.name && (
                      <p className="text-[11px] text-red-500">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-medium">Status</Label>
                    <Select
                      value={watch('status')}
                      onValueChange={(v) => setValue('status', v as any)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-medium">Upstream LB Policy</Label>
                    <Select
                      value={watch('lbAlgorithm')}
                      onValueChange={(v) => setValue('lbAlgorithm', v as any)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">Round Robin</SelectItem>
                        <SelectItem value="least_conn">Least Connections</SelectItem>
                        <SelectItem value="ip_hash">IP Hash (Session Sticky)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-400">
                      Traffic distribution strategy across the upstream pool
                    </p>
                  </div>

                  {/* Info callout */}
                  <div className="mt-auto border-l-2 border-primary/40 pl-3 py-0.5">
                    <p className="text-[12px] font-medium text-slate-700 mb-0.5">High Availability</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Add 2+ origins to enable automatic failover. Traffic is redistributed instantly when a server becomes unreachable.
                    </p>
                  </div>
                </ColPanel>

                <ColDivider />

                {/* ── Right column: origin servers ── */}
                <ColPanel className="flex-1 pl-6 overflow-y-auto max-h-[520px]">
                  <div className="flex items-center justify-between">
                    <SectionTitle>Origin Servers <span className="text-red-500 normal-case font-normal tracking-normal text-[11px]">*</span></SectionTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[12px] px-2.5"
                      onClick={() => appendUpstream({ host: '', port: 80, protocol: 'http', sslVerify: true, weight: 1, maxFails: 3, failTimeout: 30 })}
                      disabled={isLoading}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Origin
                    </Button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {upstreamFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Origin #{index + 1}
                          </span>
                          {upstreamFields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeUpstream(index)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Host / Port / Protocol */}
                        <div className="grid grid-cols-5 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px]">Host *</Label>
                            <Input
                              {...register(`upstreams.${index}.host`, { required: true })}
                              placeholder="10.0.1.10"
                              className="h-8 text-[12px]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Port</Label>
                            <Input
                              type="number"
                              {...register(`upstreams.${index}.port`, { min: 1, max: 65535 })}
                              placeholder="80"
                              className="h-8 text-[12px]"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px]">Protocol</Label>
                            <Select
                              value={watch(`upstreams.${index}.protocol`)}
                              onValueChange={(v) => setValue(`upstreams.${index}.protocol`, v as any)}
                            >
                              <SelectTrigger className="h-8 text-[12px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="http">HTTP</SelectItem>
                                <SelectItem value="https">HTTPS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {watch(`upstreams.${index}.protocol`) === 'https' && (
                          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded px-2.5 py-2">
                            <Label className="text-[11px] text-amber-700">Bypass TLS Peer Verification</Label>
                            <Controller
                              name={`upstreams.${index}.sslVerify`}
                              control={control}
                              render={({ field }) => (
                                <Switch
                                  checked={!field.value}
                                  onCheckedChange={(c) => field.onChange(!c)}
                                />
                              )}
                            />
                          </div>
                        )}

                        {/* Weight / Max Fails / Fail Timeout */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-400">Weight</Label>
                            <Input
                              type="number"
                              {...register(`upstreams.${index}.weight`, { min: 1, max: 100 })}
                              className="h-7 text-[12px]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-400">Max Fails</Label>
                            <Input
                              type="number"
                              {...register(`upstreams.${index}.maxFails`, { min: 1, max: 10 })}
                              className="h-7 text-[12px]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-400">Timeout (s)</Label>
                            <Input
                              type="number"
                              {...register(`upstreams.${index}.failTimeout`, { min: 1, max: 300 })}
                              className="h-7 text-[12px]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ColPanel>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════
                TAB 2 — SECURITY
                Left: WAF + SSL | Right: Real IP + Health Check
            ══════════════════════════════════════ */}
            <TabsContent value="security" className="mt-4">
              <div className="flex gap-0 min-h-[420px]">

                {/* ── Left: WAF + SSL ── */}
                <ColPanel className="w-[50%] pr-6">
                  {/* WAF */}
                  <div>
                    <SectionTitle><Shield className="inline h-3 w-3 mr-1" />Web Application Firewall</SectionTitle>
                    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                      <ToggleRow
                        id="modsec"
                        label="OWASP CRS Policy Enforcement"
                        description="Inspect and filter HTTP/S traffic against OWASP Core Rule Set v3.3 signatures"
                      >
                        <Controller
                          name="modsecEnabled"
                          control={control}
                          render={({ field }) => (
                            <Switch id="modsec" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </ToggleRow>
                    </div>
                  </div>

                  {/* SSL */}
                  {!domain && (
                    <div>
                      <SectionTitle><Lock className="inline h-3 w-3 mr-1" />TLS Termination</SectionTitle>
                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                        <ToggleRow
                          id="autoSSL"
                          label="Provision TLS Certificate via ACME"
                          description="Auto-issue and renew a certificate via ACME protocol (Let's Encrypt / ZeroSSL)"
                        >
                          <Controller
                            name="autoCreateSSL"
                            control={control}
                            render={({ field }) => (
                              <Switch id="autoSSL" checked={field.value} onCheckedChange={field.onChange} />
                            )}
                          />
                        </ToggleRow>
                      </div>

                      {autoCreateSSL && (
                        <div className="mt-3 space-y-1.5">
                          <Label className="text-[12px] font-medium">
                            ACME Contact Email <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="email"
                            {...register('sslEmail', {
                              required: autoCreateSSL ? 'Email required for SSL' : false,
                              pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' },
                            })}
                            placeholder="admin@example.com"
                            className="h-9 text-[13px]"
                          />
                          {errors.sslEmail && (
                            <p className="text-[11px] text-red-500">{errors.sslEmail.message}</p>
                          )}
                          <p className="text-[11px] text-slate-400">Required for expiry alerts and ACME renewal authorization</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real IP */}
                  <div>
                    <SectionTitle><Network className="inline h-3 w-3 mr-1" />Trusted Proxy Headers</SectionTitle>
                    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                      <ToggleRow
                        id="realIp"
                        label="Extract Upstream Client IP"
                        description="Parse X-Forwarded-For or CF-Connecting-IP to recover the originating client IP behind a CDN or L4 proxy"
                      >
                        <Controller
                          name="realIpEnabled"
                          control={control}
                          render={({ field }) => (
                            <Switch id="realIp" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </ToggleRow>

                      {realIpEnabled && (
                        <ToggleRow
                          id="cloudflare"
                          label="Allow Cloudflare Proxy IPs"
                          description="Whitelist Cloudflare's published CIDR ranges as set_real_ip_from sources"
                        >
                          <Controller
                            name="realIpCloudflare"
                            control={control}
                            render={({ field }) => (
                              <Switch id="cloudflare" checked={field.value} onCheckedChange={field.onChange} />
                            )}
                          />
                        </ToggleRow>
                      )}
                    </div>
                  </div>
                </ColPanel>

                <ColDivider />

                {/* ── Right: Health Check ── */}
                <ColPanel className="flex-1 pl-6">
                  <div>
                    <SectionTitle><Activity className="inline h-3 w-3 mr-1" />Origin Health Monitoring</SectionTitle>
                    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                      <ToggleRow
                        id="healthCheck"
                        label="Active Health Probes"
                        description="Poll upstream endpoints and evict unhealthy origins from the load balancer pool"
                      >
                        <Controller
                          name="healthCheckEnabled"
                          control={control}
                          render={({ field }) => (
                            <Switch id="healthCheck" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </ToggleRow>
                    </div>
                  </div>

                  {healthCheckEnabled && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium">Probe Endpoint</Label>
                        <Input
                          {...register('healthCheckPath')}
                          placeholder="/health"
                          className="h-9 text-[13px] bg-white"
                        />
                        <p className="text-[11px] text-slate-400">Target path; expects HTTP 2xx to mark origin as healthy</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] font-medium">Probe Interval (s)</Label>
                          <Input
                            type="number"
                            {...register('healthCheckInterval', { min: 1, max: 300 })}
                            className="h-9 text-[13px] bg-white"
                          />
                          <p className="text-[11px] text-slate-400">Frequency of outbound health probe requests</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] font-medium">Probe Timeout (s)</Label>
                          <Input
                            type="number"
                            {...register('healthCheckTimeout', { min: 1, max: 60 })}
                            className="h-9 text-[13px] bg-white"
                          />
                          <p className="text-[11px] text-slate-400">Max response wait before marking origin unhealthy</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security posture summary */}
                  <div className="mt-auto pt-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[11px] font-semibold text-slate-600 mb-2">Security Posture</p>
                    <div className="space-y-1">
                      {[
                        { label: 'OWASP WAF Policy', on: watch('modsecEnabled') },
                        { label: 'TLS Termination', on: watch('autoCreateSSL') || !!domain },
                        { label: 'Trusted Proxy Headers', on: watch('realIpEnabled') },
                        { label: 'Active Health Probes', on: watch('healthCheckEnabled') },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-[11px]">
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${item.on ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className={item.on ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
                          <span className={`ml-auto ${item.on ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                            {item.on ? 'On' : 'Off'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ColPanel>
              </div>
            </TabsContent>

            {/* ══════════════════════════════════════
                TAB 3 — ADVANCED
                Left: protocol / headers | Right: custom locations
            ══════════════════════════════════════ */}
            <TabsContent value="advanced" className="mt-4">
              <div className="flex gap-0 min-h-[420px]">

                {/* ── Left: protocol + headers ── */}
                <ColPanel className="w-[42%] pr-6">
                  <div>
                    <SectionTitle><Cpu className="inline h-3 w-3 mr-1" />Connection & Protocol</SectionTitle>
                    <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                      <ToggleRow
                        id="hsts"
                        label="HTTP Strict Transport Security"
                        description="Emit Strict-Transport-Security header to enforce HTTPS and prevent protocol downgrade attacks"
                      >
                        <Controller
                          name="hstsEnabled"
                          control={control}
                          render={({ field }) => (
                            <Switch id="hsts" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </ToggleRow>

                      <ToggleRow
                        id="http2"
                        label="HTTP/2 Multiplexing"
                        description="Enable h2 over TLS for request multiplexing and header compression"
                      >
                        <Controller
                          name="http2Enabled"
                          control={control}
                          render={({ field }) => (
                            <Switch id="http2" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </ToggleRow>

                      <TooltipProvider>
                        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <label htmlFor="grpc" className="text-[13px] font-medium text-slate-700">gRPC Passthrough</label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  Routes root location (/) via grpc_pass / grpcs_pass instead of proxy_pass
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">Route root location via grpc_pass / grpcs_pass instead of proxy_pass</p>
                          </div>
                          <Controller
                            name="grpcEnabled"
                            control={control}
                            render={({ field }) => (
                              <Switch id="grpc" checked={field.value} onCheckedChange={field.onChange} />
                            )}
                          />
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>Traffic Limits</SectionTitle>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium">Client Body Size Limit (MB)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10000"
                        {...register('clientMaxBodySize', {
                          required: true,
                          min: { value: 1, message: 'Min 1 MB' },
                          max: { value: 10000, message: 'Max 10000 MB' },
                        })}
                        placeholder="100"
                        disabled={isLoading}
                        className="h-9 text-[13px]"
                      />
                      {errors.clientMaxBodySize && (
                        <p className="text-[11px] text-red-500">{errors.clientMaxBodySize.message}</p>
                      )}
                      <p className="text-[11px] text-slate-400">Enforced as nginx <code className="font-mono">client_max_body_size</code>; applies to all upload requests</p>
                    </div>
                  </div>
                </ColPanel>

                <ColDivider />

                {/* ── Right: custom locations ── */}
                <ColPanel className="flex-1 pl-6 overflow-y-auto max-h-[520px]">
                  <div className="flex items-center justify-between">
                    <SectionTitle><FileCode className="inline h-3 w-3 mr-1" />Path-Based Routing Rules</SectionTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[12px] px-2.5"
                      onClick={() => appendLocation({
                        path: '',
                        upstreamType: 'proxy_pass',
                        upstreams: [],
                        config: '',
                      })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Rule
                    </Button>
                  </div>

                  {locationFields.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 border border-dashed border-slate-200 rounded-lg text-center">
                      <FileCode className="h-6 w-6 text-slate-300 mb-2" />
                      <p className="text-[12px] text-slate-400">No routing rules configured</p>
                      <p className="text-[11px] text-slate-400">Define per-path upstream overrides or inject raw nginx directives</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {locationFields.map((field, locationIndex) => {
                      const useUpstream = watch(`customLocations.${locationIndex}.upstreamType`);
                      return (
                        <div key={field.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              Location #{locationIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLocation(locationIndex)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px]">Location Path *</Label>
                            <Input
                              {...register(`customLocations.${locationIndex}.path`)}
                              placeholder="/api"
                              className="h-8 text-[12px]"
                            />
                          </div>

                          {/* Route to Origin toggle */}
                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[12px] font-medium">Proxy to Upstream</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    On: route to upstream pool · Off: inject raw nginx directives
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Controller
                              name={`customLocations.${locationIndex}.upstreamType`}
                              control={control}
                              render={({ field }) => (
                                <Switch
                                  checked={(field.value as string) !== ''}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked ? 'proxy_pass' : '');
                                    if (checked) {
                                      const curr = watch(`customLocations.${locationIndex}.upstreams`) || [];
                                      if (curr.length === 0) {
                                        setValue(`customLocations.${locationIndex}.upstreams`, [
                                          { host: '', port: 80, protocol: 'http', sslVerify: true, weight: 1, maxFails: 3, failTimeout: 30 },
                                        ]);
                                      }
                                    }
                                  }}
                                />
                              )}
                            />
                          </div>

                          {useUpstream && (useUpstream as string) !== '' ? (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label className="text-[11px]">Proxy Method</Label>
                                <Select
                                  value={watch(`customLocations.${locationIndex}.upstreamType`)}
                                  onValueChange={(v) => setValue(`customLocations.${locationIndex}.upstreamType`, v as any)}
                                >
                                  <SelectTrigger className="h-8 text-[12px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="proxy_pass">HTTP/HTTPS Proxy</SelectItem>
                                    <SelectItem value="grpc_pass">gRPC (HTTP/2)</SelectItem>
                                    <SelectItem value="grpcs_pass">gRPC (TLS)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {(watch(`customLocations.${locationIndex}.upstreams`) || []).map((_: any, ui: number) => (
                                <div key={ui} className="rounded border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Server #{ui + 1}</span>
                                    {(watch(`customLocations.${locationIndex}.upstreams`) || []).length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const curr = watch(`customLocations.${locationIndex}.upstreams`) || [];
                                          setValue(`customLocations.${locationIndex}.upstreams`, curr.filter((_: any, i: number) => i !== ui));
                                        }}
                                        className="text-slate-300 hover:text-red-400"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Host *</Label>
                                      <Input {...register(`customLocations.${locationIndex}.upstreams.${ui}.host`, { required: true })} placeholder="192.168.1.10" className="h-7 text-[11px]" />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Port</Label>
                                      <Input type="number" {...register(`customLocations.${locationIndex}.upstreams.${ui}.port`, { min: 1, max: 65535 })} placeholder="80" className="h-7 text-[11px]" />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Protocol</Label>
                                      <Select
                                        value={watch(`customLocations.${locationIndex}.upstreams.${ui}.protocol`)}
                                        onValueChange={(v) => setValue(`customLocations.${locationIndex}.upstreams.${ui}.protocol`, v as any)}
                                      >
                                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="http">HTTP</SelectItem>
                                          <SelectItem value="https">HTTPS</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px] w-full border border-dashed border-slate-200"
                                onClick={() => {
                                  const curr = watch(`customLocations.${locationIndex}.upstreams`) || [];
                                  setValue(`customLocations.${locationIndex}.upstreams`, [...curr, { host: '', port: 80, protocol: 'http', sslVerify: true, weight: 1, maxFails: 3, failTimeout: 30 }]);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Upstream
                              </Button>

                              <div className="space-y-1">
                                <Label className="text-[11px]">Extra nginx Directives (optional)</Label>
                                <Textarea
                                  {...register(`customLocations.${locationIndex}.config`)}
                                  placeholder="# Appended after auto-generated proxy_pass block. Do not redeclare proxy_pass."
                                  rows={2}
                                  className="text-[11px] font-mono"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label className="text-[11px] text-red-500">Raw nginx Location Config <span className="font-normal">(required)</span></Label>
                              <Textarea
                                {...register(`customLocations.${locationIndex}.config`)}
                                placeholder={`proxy_pass http://192.168.1.100:8080/;\nproxy_set_header Host $host;`}
                                rows={4}
                                className="text-[11px] font-mono"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ColPanel>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="text-[13px] px-6">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving…
                </span>
              ) : domain ? 'Save Changes' : 'Create Site'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
