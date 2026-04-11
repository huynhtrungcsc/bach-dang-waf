import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useCreateNLB, useUpdateNLB } from '@/queries/nlb.query-options';
import { NetworkLoadBalancer, CreateNLBInput } from '@/types';
import {
  validateNLBConfig,
  isValidNLBName,
  validateUpstreamHost,
  getValidationHints,
  checkConfigurationWarnings,
} from '@/utils/nlb-validators';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, HelpCircle, AlertTriangle, Network, X } from 'lucide-react';
import { toast } from 'sonner';

interface NLBFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nlb?: NetworkLoadBalancer | null;
  mode: 'create' | 'edit';
}

type FormData = CreateNLBInput;

/* ── Compact field label ── */
const FL = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-[12px] font-medium">{children}</Label>
);

/* ── Helper text ── */
const FH = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-slate-400">{children}</p>
);

export default function NLBFormDialog({ isOpen, onClose, nlb, mode }: NLBFormDialogProps) {
  const createMutation = useCreateNLB();
  const updateMutation = useUpdateNLB();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const [configWarnings, setConfigWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
      description: '',
      port: 10000,
      protocol: 'tcp',
      algorithm: 'round_robin',
      upstreams: [{ host: '', port: 80, weight: 1, maxFails: 3, failTimeout: 10, maxConns: 0, backup: false, down: false }],
      proxyTimeout: 3,
      proxyConnectTimeout: 1,
      proxyNextUpstream: true,
      proxyNextUpstreamTimeout: 0,
      proxyNextUpstreamTries: 0,
      healthCheckEnabled: true,
      healthCheckInterval: 10,
      healthCheckTimeout: 5,
      healthCheckRises: 2,
      healthCheckFalls: 3,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'upstreams' });

  const protocol            = watch('protocol');
  const upstreams           = watch('upstreams');
  const proxyTimeout        = watch('proxyTimeout');
  const proxyConnectTimeout = watch('proxyConnectTimeout');
  const healthCheckEnabled  = watch('healthCheckEnabled');
  const healthCheckInterval = watch('healthCheckInterval');
  const healthCheckTimeout  = watch('healthCheckTimeout');

  useEffect(() => {
    if (upstreams?.length > 0) {
      setConfigWarnings(checkConfigurationWarnings({
        upstreams,
        proxyTimeout: proxyTimeout || 3,
        proxyConnectTimeout: proxyConnectTimeout || 1,
        healthCheckEnabled: healthCheckEnabled || false,
        healthCheckInterval,
        healthCheckTimeout,
      }));
    }
  }, [upstreams, proxyTimeout, proxyConnectTimeout, healthCheckEnabled, healthCheckInterval, healthCheckTimeout]);

  useEffect(() => {
    if (!isOpen) { setValidationErrors([]); setConfigWarnings([]); return; }
    if (nlb && mode === 'edit') {
      reset({
        name: nlb.name,
        description: nlb.description || '',
        port: nlb.port,
        protocol: nlb.protocol,
        algorithm: nlb.algorithm,
        upstreams: nlb.upstreams.map(u => ({
          host: u.host, port: u.port, weight: u.weight,
          maxFails: u.maxFails, failTimeout: u.failTimeout,
          maxConns: u.maxConns, backup: u.backup, down: u.down,
        })),
        proxyTimeout: nlb.proxyTimeout,
        proxyConnectTimeout: nlb.proxyConnectTimeout,
        proxyNextUpstream: nlb.proxyNextUpstream,
        proxyNextUpstreamTimeout: nlb.proxyNextUpstreamTimeout,
        proxyNextUpstreamTries: nlb.proxyNextUpstreamTries,
        healthCheckEnabled: nlb.healthCheckEnabled,
        healthCheckInterval: nlb.healthCheckInterval,
        healthCheckTimeout: nlb.healthCheckTimeout,
        healthCheckRises: nlb.healthCheckRises,
        healthCheckFalls: nlb.healthCheckFalls,
      });
    } else if (mode === 'create') {
      reset({
        name: '', description: '', port: 10000, protocol: 'tcp', algorithm: 'round_robin',
        upstreams: [{ host: '', port: 80, weight: 1, maxFails: 3, failTimeout: 10, maxConns: 0, backup: false, down: false }],
        proxyTimeout: 3, proxyConnectTimeout: 1, proxyNextUpstream: true,
        proxyNextUpstreamTimeout: 0, proxyNextUpstreamTries: 0,
        healthCheckEnabled: true, healthCheckInterval: 10, healthCheckTimeout: 5,
        healthCheckRises: 2, healthCheckFalls: 3,
      });
    }
  }, [isOpen, nlb, mode, reset]);

  const onSubmit = async (data: FormData) => {
    const validation = validateNLBConfig({
      name: data.name,
      port: Number(data.port),
      upstreams: data.upstreams.map(u => ({
        host: u.host, port: Number(u.port), weight: Number(u.weight),
        maxFails: Number(u.maxFails), failTimeout: Number(u.failTimeout),
        maxConns: Number(u.maxConns), backup: Boolean(u.backup), down: Boolean(u.down),
      })),
      proxyTimeout: Number(data.proxyTimeout),
      proxyConnectTimeout: Number(data.proxyConnectTimeout),
      proxyNextUpstreamTimeout: Number(data.proxyNextUpstreamTimeout),
      proxyNextUpstreamTries: Number(data.proxyNextUpstreamTries),
      healthCheckEnabled: Boolean(data.healthCheckEnabled),
      healthCheckInterval: Number(data.healthCheckInterval),
      healthCheckTimeout: Number(data.healthCheckTimeout),
      healthCheckRises: Number(data.healthCheckRises),
      healthCheckFalls: Number(data.healthCheckFalls),
    });

    if (!validation.valid) {
      const msgs = Object.entries(validation.errors).map(([field, error]) => {
        const names: Record<string, string> = {
          name: 'Listener Name', port: 'Listener Port', upstreams: 'Origin Servers',
          proxyTimeout: 'Upstream Response Timeout', proxyConnectTimeout: 'TCP Connect Timeout',
          proxyNextUpstreamTimeout: 'Failover Window', proxyNextUpstreamTries: 'Max Failover Attempts',
          healthCheckInterval: 'Probe Interval', healthCheckTimeout: 'Probe Timeout',
          healthCheckRises: 'Healthy Threshold', healthCheckFalls: 'Unhealthy Threshold',
        };
        return `${names[field] || field}: ${error}`;
      });
      setValidationErrors(msgs);
      return;
    }

    setValidationErrors([]);
    const processed = {
      ...data,
      port: Number(data.port),
      proxyTimeout: Number(data.proxyTimeout),
      proxyConnectTimeout: Number(data.proxyConnectTimeout),
      proxyNextUpstream: Boolean(data.proxyNextUpstream),
      proxyNextUpstreamTimeout: Number(data.proxyNextUpstreamTimeout),
      proxyNextUpstreamTries: Number(data.proxyNextUpstreamTries),
      healthCheckEnabled: Boolean(data.healthCheckEnabled),
      healthCheckInterval: Number(data.healthCheckInterval),
      healthCheckTimeout: Number(data.healthCheckTimeout),
      healthCheckRises: Number(data.healthCheckRises),
      healthCheckFalls: Number(data.healthCheckFalls),
      upstreams: data.upstreams.map(u => ({
        ...u, port: Number(u.port), weight: Number(u.weight),
        maxFails: Number(u.maxFails), failTimeout: Number(u.failTimeout),
        maxConns: Number(u.maxConns), backup: Boolean(u.backup), down: Boolean(u.down),
      })),
    };

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(processed);
        toast.success('Load balancer deployed successfully');
      } else if (nlb) {
        await updateMutation.mutateAsync({ id: nlb.id, data: processed });
        toast.success('Load balancer configuration updated');
      }
      onClose();
    } catch (error: any) {
      const response = error.response?.data;
      let msgs: string[] = [];
      if (response?.errors && Array.isArray(response.errors)) {
        msgs = response.errors.map((e: any) => e.path ? `${e.path}: ${e.msg}` : e.msg || e.message || 'Unknown error');
        setValidationErrors(msgs);
      } else if (response?.message) {
        const m = response.message;
        if (m.includes('already exists')) msgs = ['A load balancer with this name already exists'];
        else if (m.includes('host not found') || m.includes('Invalid host')) msgs = ['Invalid origin host – check IP address or FQDN format'];
        else if (m.toLowerCase().includes('nginx') || m.includes('NLB configuration') || m.includes('proxy engine')) msgs = ['Proxy engine error – listener configuration could not be applied. Check Nginx status.'];
        else msgs = [m];
        setValidationErrors(msgs);
      } else {
        msgs = [`Failed to ${mode === 'create' ? 'deploy' : 'update'} load balancer. Verify configuration.`];
        setValidationErrors(msgs);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2">
            <Network className="h-4 w-4 text-slate-500" />
            {mode === 'create' ? 'Deploy' : 'Edit'} Layer 4 Load Balancer
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Configure a TCP/UDP traffic distributor with upstream origin pools, health probes, and failover policy.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Validation error banner */}
          {validationErrors.length > 0 && (
            <div className="flex items-start gap-3 border-l-2 border-red-400 bg-slate-50 rounded-r-md pl-3 pr-4 py-3">
              <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-medium text-slate-700 mb-1.5">
                  Fix {validationErrors.length} error{validationErrors.length > 1 ? 's' : ''} before submitting
                </p>
                <ul className="space-y-0.5">
                  {validationErrors.map((e, i) => <li key={i} className="text-[11px] text-slate-500">— {e}</li>)}
                </ul>
              </div>
            </div>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9 mb-1">
              <TabsTrigger value="basic" className="text-[12px]">Basic Configuration</TabsTrigger>
              <TabsTrigger value="upstreams" className="text-[12px]">Origin Server Pool</TabsTrigger>
              <TabsTrigger value="advanced" className="text-[12px]">Proxy &amp; Health Probes</TabsTrigger>
            </TabsList>

            {/* ══ BASIC TAB ══ */}
            <TabsContent value="basic" className="mt-4">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                {/* LEFT: Listener Name */}
                <div className="flex flex-col gap-1.5">
                  <FL>Listener Name <span className="text-red-500">*</span></FL>
                  <Input
                    {...register('name', {
                      required: 'Name is required',
                      validate: (v) => { const r = isValidNLBName(v); return r.valid || r.error || 'Invalid name'; },
                    })}
                    placeholder="prod-api-lb"
                    className="h-9 text-[13px]"
                  />
                  {errors.name
                    ? <p className="text-[11px] text-red-500">{errors.name.message}</p>
                    : <FH>{getValidationHints('name')}</FH>
                  }
                </div>

                {/* RIGHT: Transport Protocol */}
                <div className="flex flex-col gap-1.5">
                  <FL>Transport Protocol <span className="text-red-500">*</span></FL>
                  <Select value={protocol} onValueChange={(v) => setValue('protocol', v as any)}>
                    <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">TCP – Connection-oriented stream</SelectItem>
                      <SelectItem value="udp">UDP – Connectionless datagram</SelectItem>
                      <SelectItem value="tcp_udp">TCP + UDP – Dual stack</SelectItem>
                    </SelectContent>
                  </Select>
                  <FH>Layer 4 protocol the listener accepts</FH>
                </div>

                {/* LEFT: Listener Port */}
                <div className="flex flex-col gap-1.5">
                  <FL>Listener Port <span className="text-red-500">*</span></FL>
                  <Input
                    type="number"
                    {...register('port', {
                      required: 'Port is required',
                      min: { value: 10000, message: 'Port must be ≥ 10000' },
                      max: { value: 65535, message: 'Port must be ≤ 65535' },
                      valueAsNumber: true,
                    })}
                    className="h-9 text-[13px] font-mono"
                  />
                  {errors.port
                    ? <p className="text-[11px] text-red-500">{errors.port.message}</p>
                    : <FH>{getValidationHints('port')}</FH>
                  }
                </div>

                {/* RIGHT: Distribution Algorithm */}
                <div className="flex flex-col gap-1.5">
                  <FL>Distribution Algorithm</FL>
                  <Select defaultValue="round_robin" onValueChange={(v) => setValue('algorithm', v as any)}>
                    <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin">Round Robin – Equal weight rotation</SelectItem>
                      <SelectItem value="least_conn">Least Outstanding Requests</SelectItem>
                      <SelectItem value="ip_hash">IP Affinity – Session persistence by client IP</SelectItem>
                      <SelectItem value="hash">Generic Hash – Custom key hashing</SelectItem>
                    </SelectContent>
                  </Select>
                  <FH>Strategy for distributing new connections across origins</FH>
                </div>

                {/* FULL WIDTH: Notes */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <FL>Notes <span className="font-normal text-slate-400">(optional)</span></FL>
                  <Textarea
                    {...register('description')}
                    placeholder="Brief description of this load balancer's purpose, environment, or traffic type"
                    rows={2}
                    className="text-[13px] resize-none"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ══ UPSTREAMS TAB ══ */}
            <TabsContent value="upstreams" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">Origin Server Pool</p>
                  <p className="text-[11px] text-slate-400">Backend targets that receive proxied traffic from this listener</p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ host: '', port: 80, weight: 1, maxFails: 3, failTimeout: 10, maxConns: 0, backup: false, down: false })}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Origin
                </button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="border border-slate-200 rounded-md overflow-hidden">
                  {/* origin header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Origin {index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="p-1 rounded hover:bg-slate-100">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Row 1: Host | Port */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <FL>Origin Host <span className="text-red-500">*</span></FL>
                        <Input
                          {...register(`upstreams.${index}.host`, {
                            required: 'Host is required',
                            validate: (v) => { const r = validateUpstreamHost(v); return r.valid || r.error || 'Invalid host'; },
                          })}
                          placeholder="10.0.0.1 or backend.internal"
                          className="h-8 text-[13px] font-mono"
                        />
                        {errors.upstreams?.[index]?.host
                          ? <p className="text-[11px] text-red-500">{errors.upstreams[index]?.host?.message}</p>
                          : <FH>{getValidationHints('host')}</FH>
                        }
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <FL>Origin Port <span className="text-red-500">*</span></FL>
                        <Input
                          type="number"
                          {...register(`upstreams.${index}.port`, {
                            required: 'Port is required',
                            min: { value: 1, message: 'Port ≥ 1' },
                            max: { value: 65535, message: 'Port ≤ 65535' },
                            valueAsNumber: true,
                          })}
                          className="h-8 text-[13px] font-mono"
                        />
                        {errors.upstreams?.[index]?.port && (
                          <p className="text-[11px] text-red-500">{errors.upstreams[index]?.port?.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Weight | Max Failure Threshold | Failure Recovery Window */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <FL>Traffic Weight</FL>
                        <Input
                          type="number"
                          {...register(`upstreams.${index}.weight`, {
                            min: { value: 1, message: 'Weight ≥ 1' },
                            max: { value: 100, message: 'Weight ≤ 100' },
                            valueAsNumber: true,
                          })}
                          className="h-8 text-[13px]"
                        />
                        {errors.upstreams?.[index]?.weight && (
                          <p className="text-[11px] text-red-500">{errors.upstreams[index]?.weight?.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <FL>Failure Threshold</FL>
                        <Input
                          type="number"
                          {...register(`upstreams.${index}.maxFails`, {
                            min: { value: 0, message: 'Max fails ≥ 0' },
                            max: { value: 100, message: 'Max fails ≤ 100' },
                            valueAsNumber: true,
                          })}
                          className="h-8 text-[13px]"
                        />
                        {errors.upstreams?.[index]?.maxFails && (
                          <p className="text-[11px] text-red-500">{errors.upstreams[index]?.maxFails?.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <FL>Recovery Window (s)</FL>
                        <Input
                          type="number"
                          {...register(`upstreams.${index}.failTimeout`, {
                            min: { value: 1, message: 'Fail timeout ≥ 1' },
                            max: { value: 3600, message: 'Fail timeout ≤ 3600' },
                            valueAsNumber: true,
                          })}
                          className="h-8 text-[13px]"
                        />
                        {errors.upstreams?.[index]?.failTimeout && (
                          <p className="text-[11px] text-red-500">{errors.upstreams[index]?.failTimeout?.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Max Connections | Standby | Force Drain */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <FL>Max Concurrent Conns</FL>
                        <Input
                          type="number"
                          {...register(`upstreams.${index}.maxConns`, {
                            min: { value: 0, message: 'Max connections ≥ 0' },
                            max: { value: 100000, message: 'Max connections ≤ 100000' },
                            valueAsNumber: true,
                          })}
                          placeholder="0 = unlimited"
                          className="h-8 text-[13px]"
                        />
                        {errors.upstreams?.[index]?.maxConns && (
                          <p className="text-[11px] text-red-500">{errors.upstreams[index]?.maxConns?.message}</p>
                        )}
                      </div>

                      <TooltipProvider>
                        <div className="flex flex-col justify-end gap-1.5">
                          <FL>Standby Mode</FL>
                          <div className="flex items-center gap-2 h-8">
                            <Controller
                              name={`upstreams.${index}.backup`}
                              control={control}
                              render={({ field }) => (
                                <Switch id={`backup-${index}`} checked={field.value} onCheckedChange={field.onChange} />
                              )}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                              <TooltipContent><p>Receives traffic only when all primary origins are unavailable</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </TooltipProvider>

                      <TooltipProvider>
                        <div className="flex flex-col justify-end gap-1.5">
                          <FL>Force Drain</FL>
                          <div className="flex items-center gap-2 h-8">
                            <Controller
                              name={`upstreams.${index}.down`}
                              control={control}
                              render={({ field }) => (
                                <Switch id={`down-${index}`} checked={field.value} onCheckedChange={field.onChange} />
                              )}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-slate-400" /></TooltipTrigger>
                              <TooltipContent><p>Immediately removes this origin from active rotation (maintenance / decommission)</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              ))}

              {errors.upstreams && (
                <p className="text-[11px] text-red-500">At least one origin server is required</p>
              )}

              {configWarnings.length > 0 && (
                <div className="flex items-start gap-3 border-l-2 border-amber-400 bg-slate-50 rounded-r-md pl-3 pr-4 py-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-slate-700 mb-1.5">
                      {configWarnings.length} configuration warning{configWarnings.length > 1 ? 's' : ''}
                    </p>
                    <ul className="space-y-0.5">
                      {configWarnings.map((w, i) => <li key={i} className="text-[11px] text-slate-500">— {w}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ══ ADVANCED TAB ══ */}
            <TabsContent value="advanced" className="mt-4">
              <div className="grid grid-cols-2 gap-x-6">

                {/* LEFT: TCP Proxy Settings */}
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">TCP Proxy Settings</p>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-1.5">
                        <FL>Upstream Response Timeout (s)</FL>
                        <Input
                          type="number"
                          {...register('proxyTimeout', {
                            min: { value: 1, message: 'Proxy timeout ≥ 1' },
                            max: { value: 3600, message: 'Proxy timeout ≤ 3600' },
                            valueAsNumber: true,
                          })}
                          className="h-9 text-[13px]"
                        />
                        {errors.proxyTimeout
                          ? <p className="text-[11px] text-red-500">{errors.proxyTimeout.message}</p>
                          : <FH>{getValidationHints('proxyTimeout')}</FH>
                        }
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <FL>TCP Connect Timeout (s)</FL>
                        <Input
                          type="number"
                          {...register('proxyConnectTimeout', {
                            min: { value: 1, message: 'Connect timeout ≥ 1' },
                            max: { value: 300, message: 'Connect timeout ≤ 300' },
                            valueAsNumber: true,
                          })}
                          className="h-9 text-[13px]"
                        />
                        {errors.proxyConnectTimeout
                          ? <p className="text-[11px] text-red-500">{errors.proxyConnectTimeout.message}</p>
                          : <FH>{getValidationHints('proxyConnectTimeout')}</FH>
                        }
                      </div>

                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700">Automatic Failover</p>
                          <p className="text-[11px] text-slate-400">Retry failed request on next available origin</p>
                        </div>
                        <Controller
                          name="proxyNextUpstream"
                          control={control}
                          render={({ field }) => (
                            <Switch id="proxyNextUpstream" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <FL>Failover Window (s)</FL>
                          <Input
                            type="number"
                            {...register('proxyNextUpstreamTimeout', {
                              min: { value: 0, message: 'Timeout ≥ 0' },
                              max: { value: 3600, message: 'Timeout ≤ 3600' },
                              valueAsNumber: true,
                            })}
                            placeholder="0 = disabled"
                            className="h-9 text-[13px]"
                          />
                          {errors.proxyNextUpstreamTimeout && (
                            <p className="text-[11px] text-red-500">{errors.proxyNextUpstreamTimeout.message}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <FL>Max Failover Attempts</FL>
                          <Input
                            type="number"
                            {...register('proxyNextUpstreamTries', {
                              min: { value: 0, message: 'Tries ≥ 0' },
                              max: { value: 100, message: 'Tries ≤ 100' },
                              valueAsNumber: true,
                            })}
                            placeholder="0 = unlimited"
                            className="h-9 text-[13px]"
                          />
                          {errors.proxyNextUpstreamTries && (
                            <p className="text-[11px] text-red-500">{errors.proxyNextUpstreamTries.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Active Health Probes */}
                <div className="border-l border-slate-100 pl-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Active Health Probes</p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700">Enable Health Probing</p>
                          <p className="text-[11px] text-slate-400">Actively monitor origin reachability</p>
                        </div>
                        <Controller
                          name="healthCheckEnabled"
                          control={control}
                          render={({ field }) => (
                            <Switch id="healthCheckEnabled" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <FL>Probe Interval (s)</FL>
                          <Input
                            type="number"
                            {...register('healthCheckInterval', {
                              min: { value: 5, message: 'Interval ≥ 5' },
                              max: { value: 3600, message: 'Interval ≤ 3600' },
                              valueAsNumber: true,
                            })}
                            className="h-9 text-[13px]"
                          />
                          {errors.healthCheckInterval
                            ? <p className="text-[11px] text-red-500">{errors.healthCheckInterval.message}</p>
                            : <FH>{getValidationHints('healthCheckInterval')}</FH>
                          }
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <FL>Probe Timeout (s)</FL>
                          <Input
                            type="number"
                            {...register('healthCheckTimeout', {
                              min: { value: 1, message: 'Timeout ≥ 1' },
                              max: { value: 300, message: 'Timeout ≤ 300' },
                              valueAsNumber: true,
                            })}
                            className="h-9 text-[13px]"
                          />
                          {errors.healthCheckTimeout
                            ? <p className="text-[11px] text-red-500">{errors.healthCheckTimeout.message}</p>
                            : <FH>{getValidationHints('healthCheckTimeout')}</FH>
                          }
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <FL>Healthy Threshold</FL>
                          <Input
                            type="number"
                            {...register('healthCheckRises', {
                              min: { value: 1, message: 'Rises ≥ 1' },
                              max: { value: 10, message: 'Rises ≤ 10' },
                              valueAsNumber: true,
                            })}
                            className="h-9 text-[13px]"
                          />
                          {errors.healthCheckRises && (
                            <p className="text-[11px] text-red-500">{errors.healthCheckRises.message}</p>
                          )}
                          <FH>Consecutive successes to mark origin healthy</FH>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <FL>Unhealthy Threshold</FL>
                          <Input
                            type="number"
                            {...register('healthCheckFalls', {
                              min: { value: 1, message: 'Falls ≥ 1' },
                              max: { value: 10, message: 'Falls ≤ 10' },
                              valueAsNumber: true,
                            })}
                            className="h-9 text-[13px]"
                          />
                          {errors.healthCheckFalls && (
                            <p className="text-[11px] text-red-500">{errors.healthCheckFalls.message}</p>
                          )}
                          <FH>Consecutive failures to remove origin from pool</FH>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-8 px-4 rounded-md border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending
                ? (mode === 'create' ? 'Deploying…' : 'Saving…')
                : mode === 'create'
                  ? 'Deploy Load Balancer'
                  : 'Save Configuration'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
