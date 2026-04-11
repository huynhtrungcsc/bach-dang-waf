import { useState, Suspense } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Send, Trash2, Mail, MessageSquare, Loader2,
  Bell, ShieldAlert, Activity, HardDrive, Cpu, MemoryStick,
  Lock, Radio,
} from "lucide-react";
import { SkeletonTable } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useSuspenseNotificationChannels,
  useSuspenseAlertRules,
  useCreateNotificationChannel,
  useUpdateNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotificationChannel,
  useCreateAlertRule,
  useUpdateAlertRule,
  useDeleteAlertRule
} from "@/queries";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border border-red-200",
  warning:  "bg-amber-50 text-amber-700 border border-amber-200",
  info:     "bg-slate-50 text-slate-600 border border-slate-200",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "CRITICAL",
  warning:  "MEDIUM",
  info:     "INFO",
};

const MONITOR_META: Record<string, { icon: any; label: string; hint: string }> = {
  cpu:      { icon: Cpu,          label: "CPU Utilization",          hint: "Trigger when CPU usage exceeds the configured threshold" },
  memory:   { icon: MemoryStick,  label: "Memory Utilization",       hint: "Trigger when memory usage exceeds the configured threshold" },
  disk:     { icon: HardDrive,    label: "Disk Utilization",         hint: "Trigger when disk usage exceeds the configured threshold" },
  upstream: { icon: Activity,     label: "Upstream / Origin Health", hint: "Trigger when any upstream origin server becomes unreachable" },
  ssl:      { icon: Lock,         label: "TLS Certificate Expiry",   hint: "Trigger when a TLS certificate is within N days of expiry" },
};

const getConditionForType = (type: string) => {
  switch (type) {
    case "cpu":      return "cpu > threshold";
    case "memory":   return "memory > threshold";
    case "disk":     return "disk > threshold";
    case "upstream": return "upstream_status == down";
    case "ssl":      return "ssl_days_remaining < threshold";
    default:         return "cpu > threshold";
  }
};

const fmtInterval = (s: number) => {
  if (s >= 86400) return `${s / 86400}d`;
  if (s >= 3600)  return `${s / 3600}h`;
  if (s >= 60)    return `${s / 60}m`;
  return `${s}s`;
};

// ── Notification Channels Tab ─────────────────────────────────────────────────

function NotificationChannelsTab() {
  const { data: channels } = useSuspenseNotificationChannels();
  const [isDialogOpen, setIsDialogOpen]   = useState(false);
  const [toDelete, setToDelete]           = useState<{ id: string; name: string } | null>(null);

  const createChannel = useCreateNotificationChannel();
  const updateChannel = useUpdateNotificationChannel();
  const deleteChannel = useDeleteNotificationChannel();
  const testChannel   = useTestNotificationChannel();

  const blankForm = { name: "", type: "email" as "email" | "telegram", enabled: true, email: "", chatId: "", botToken: "" };
  const [form, setForm] = useState(blankForm);
  const patch = (delta: Partial<typeof form>) => setForm(f => ({ ...f, ...delta }));

  const handleCreate = async () => {
    const config = form.type === "email"
      ? { email: form.email }
      : { chatId: form.chatId, botToken: form.botToken };
    try {
      await createChannel.mutateAsync({ name: form.name, type: form.type, enabled: form.enabled, config });
      setIsDialogOpen(false);
      setForm(blankForm);
      toast.success("Channel registered");
    } catch (err: any) {
      toast.error("Channel registration failed", { description: err.response?.data?.message || "Verify the configuration and try again." });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const ch = channels.find(c => c.id === id);
      const res = await testChannel.mutateAsync(id);
      toast.success("Test dispatch successful", { description: res.message || `Connectivity verified for channel "${ch?.name}"` });
    } catch (err: any) {
      toast.error("Channel test failed", { description: err.response?.data?.message || "Unable to reach the delivery endpoint. Check channel configuration." });
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteChannel.mutateAsync(toDelete.id);
      toast.success("Channel removed");
      setToDelete(null);
    } catch (err: any) {
      toast.error("Channel removal failed", { description: err.response?.data?.message || "The channel could not be removed." });
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const ch = channels.find(c => c.id === id);
      if (!ch) return;
      await updateChannel.mutateAsync({ id, data: { enabled: !ch.enabled } });
    } catch (err: any) {
      toast.error("Channel update failed", { description: err.response?.data?.message || "The channel status could not be updated." });
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">Delivery Channels</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Alert dispatch endpoints — SMTP, Telegram Bot</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-slate-800 text-white text-[12px] font-medium hover:bg-slate-700 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Register Channel
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-[15px] font-semibold text-slate-800">Register Delivery Channel</DialogTitle>
              <DialogDescription className="text-[12px] text-slate-400">
                Add an alert dispatch endpoint for WAF notifications
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Channel label */}
              <div className="grid gap-1.5">
                <Label htmlFor="ch-name" className="text-[12px] font-medium text-slate-600">Channel Label</Label>
                <Input
                  id="ch-name"
                  value={form.name}
                  onChange={e => patch({ name: e.target.value })}
                  placeholder="e.g., Security Team Email"
                  className="h-9 text-[13px]"
                />
              </div>

              {/* Protocol */}
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-medium text-slate-600">Delivery Protocol</Label>
                <Select value={form.type} onValueChange={v => patch({ type: v as any })}>
                  <SelectTrigger className="h-9 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email" className="text-[13px]">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        SMTP / Email
                      </div>
                    </SelectItem>
                    <SelectItem value="telegram" className="text-[13px]">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                        Telegram Bot
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Protocol-specific fields */}
              {form.type === "email" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="ch-email" className="text-[12px] font-medium text-slate-600">Recipient Address</Label>
                  <Input
                    id="ch-email"
                    type="email"
                    value={form.email}
                    onChange={e => patch({ email: e.target.value })}
                    placeholder="security@example.com"
                    className="h-9 text-[13px]"
                  />
                </div>
              ) : (
                <div className="grid gap-3 p-3 bg-slate-50 rounded-md border border-slate-100">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ch-chatid" className="text-[12px] font-medium text-slate-600">
                      Telegram Chat ID
                      <span className="ml-1.5 text-[10px] text-slate-400 font-normal">Group or user ID</span>
                    </Label>
                    <Input
                      id="ch-chatid"
                      value={form.chatId}
                      onChange={e => patch({ chatId: e.target.value })}
                      placeholder="-1001234567890"
                      className="h-9 text-[13px] font-mono bg-white"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ch-token" className="text-[12px] font-medium text-slate-600">
                      Bot API Token
                      <span className="ml-1.5 text-[10px] text-slate-400 font-normal">From @BotFather</span>
                    </Label>
                    <Input
                      id="ch-token"
                      type="password"
                      value={form.botToken}
                      onChange={e => patch({ botToken: e.target.value })}
                      placeholder="1234567890:ABCdefGHI..."
                      className="h-9 text-[13px] font-mono bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
                <div>
                  <p className="text-[12px] font-medium text-slate-700">Activate channel</p>
                  <p className="text-[11px] text-slate-400">Enable for immediate alert dispatch</p>
                </div>
                <Switch
                  id="ch-enabled"
                  checked={form.enabled}
                  onCheckedChange={v => patch({ enabled: v })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} disabled={createChannel.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={createChannel.isPending}>
                {createChannel.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Register Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider pl-5 py-2.5">Channel Label</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Protocol</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Endpoint</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Active</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-right pr-5 py-2.5">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {channels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-14 text-center">
                <Radio className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-[13px] text-slate-400 font-medium">No delivery channels registered</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Register a channel to enable alert dispatch</p>
              </TableCell>
            </TableRow>
          ) : channels.map(ch => (
            <TableRow key={ch.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
              <TableCell className="font-medium text-[13px] text-slate-800 pl-5 py-3">{ch.name}</TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                  {ch.type === "email"
                    ? <><Mail className="h-3 w-3" /> SMTP</>
                    : <><MessageSquare className="h-3 w-3" /> Telegram</>
                  }
                </span>
              </TableCell>
              <TableCell className="font-mono text-[12px] text-slate-500 py-3">
                {ch.type === "email" ? ch.config.email : ch.config.chatId}
              </TableCell>
              <TableCell className="py-3">
                <Switch checked={ch.enabled} onCheckedChange={() => handleToggle(ch.id)} />
              </TableCell>
              <TableCell className="text-right pr-5 py-3 space-x-1">
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                  title="Send test probe"
                  onClick={() => handleTest(ch.id)}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                  title="Decommission channel"
                  onClick={() => setToDelete({ id: ch.id, name: ch.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Decommission Delivery Channel"
        description={
          <>
            Permanently remove channel <strong>{toDelete?.name}</strong>?
            <br />
            All alert rules referencing this channel will lose this dispatch endpoint.
          </>
        }
        confirmText="Remove Channel"
        cancelText="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteChannel.isPending}
        variant="destructive"
      />
    </div>
  );
}

// ── Alert Rules Tab ───────────────────────────────────────────────────────────

const MONITOR_OPTIONS = [
  { value: "cpu",      label: "CPU Utilization",          defaultThreshold: 80,    defaultInterval: 30,    defaultName: "High CPU Utilization" },
  { value: "memory",   label: "Memory Utilization",       defaultThreshold: 85,    defaultInterval: 30,    defaultName: "High Memory Utilization" },
  { value: "disk",     label: "Disk Utilization",         defaultThreshold: 90,    defaultInterval: 300,   defaultName: "High Disk Utilization" },
  { value: "upstream", label: "Upstream / Origin Health", defaultThreshold: 1,     defaultInterval: 60,    defaultName: "Origin Server Unreachable" },
  { value: "ssl",      label: "TLS Certificate Expiry",   defaultThreshold: 30,    defaultInterval: 86400, defaultName: "TLS Certificate Expiring Soon" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "info",     label: "INFO"     },
  { value: "warning",  label: "MEDIUM"   },
  { value: "critical", label: "CRITICAL" },
] as const;

function AlertRulesTab() {
  const { data: channels }   = useSuspenseNotificationChannels();
  const { data: alertRules } = useSuspenseAlertRules();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [toDelete, setToDelete]         = useState<{ id: string; name: string } | null>(null);

  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const blankForm = {
    name: "", alertType: "cpu" as "cpu" | "ssl" | "memory" | "disk" | "upstream",
    condition: getConditionForType("cpu"),
    threshold: 80, severity: "warning" as "critical" | "warning" | "info",
    channels: [] as string[], enabled: true, checkInterval: 30
  };
  const [form, setForm] = useState(blankForm);
  const patch = (delta: Partial<typeof form>) => setForm(f => ({ ...f, ...delta }));

  const handleTypeChange = (type: typeof MONITOR_OPTIONS[number]["value"]) => {
    const meta = MONITOR_OPTIONS.find(o => o.value === type)!;
    setForm(f => ({
      ...f,
      alertType:     type,
      condition:     getConditionForType(type),
      threshold:     meta.defaultThreshold,
      checkInterval: meta.defaultInterval,
      name:          f.name || meta.defaultName,
    }));
  };

  const handleCreate = async () => {
    try {
      await createRule.mutateAsync(form);
      setIsDialogOpen(false);
      setForm(blankForm);
      toast.success("Alert rule created");
    } catch (err: any) {
      toast.error("Rule creation failed", { description: err.response?.data?.message || "The alert rule could not be created." });
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteRule.mutateAsync(toDelete.id);
      toast.success("Alert rule removed");
      setToDelete(null);
    } catch (err: any) {
      toast.error("Rule removal failed", { description: err.response?.data?.message || "The alert rule could not be removed." });
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const rule = alertRules.find(r => r.id === id);
      if (!rule) return;
      await updateRule.mutateAsync({ id, data: { enabled: !rule.enabled } });
    } catch (err: any) {
      toast.error("Rule update failed", { description: err.response?.data?.message || "The alert rule could not be updated." });
    }
  };

  const activeMeta = MONITOR_META[form.alertType];

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">Detection Rules</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Threshold-based conditions · Infrastructure monitoring · WAF event triggers</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-slate-800 text-white text-[12px] font-medium hover:bg-slate-700 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Create Rule
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-[15px] font-semibold text-slate-800">Create Detection Rule</DialogTitle>
              <DialogDescription className="text-[12px] text-slate-400">
                Define a threshold-based condition that triggers WAF alert dispatch
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
              {/* LEFT COLUMN: Identification */}
              <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Monitor target */}
                <div className="grid gap-1.5">
                  <Label className="text-[12px] font-medium text-slate-600">Monitor Target</Label>
                  <Select value={form.alertType} onValueChange={handleTypeChange}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONITOR_OPTIONS.map(o => {
                        const meta = MONITOR_META[o.value]!;
                        const Icon = meta.icon;
                        return (
                          <SelectItem key={o.value} value={o.value} className="text-[13px]">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-slate-400" />
                              {o.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {activeMeta && (
                    <p className="text-[11px] text-slate-400">{activeMeta.hint}</p>
                  )}
                </div>

                {/* Rule label */}
                <div className="grid gap-1.5">
                  <Label htmlFor="rule-name" className="text-[12px] font-medium text-slate-600">Rule Label</Label>
                  <Input
                    id="rule-name"
                    value={form.name}
                    onChange={e => patch({ name: e.target.value })}
                    placeholder="e.g., Production CPU Alert"
                    className="h-9 text-[13px]"
                  />
                </div>
              </div>

              {/* Trigger expression — full width */}
              <div className="col-span-2 grid gap-1.5">
                <Label className="text-[12px] font-medium text-slate-600">Trigger Expression</Label>
                <Input
                  value={form.condition}
                  disabled
                  className="h-9 text-[13px] font-mono bg-slate-50 text-slate-500"
                />
                <p className="text-[11px] text-slate-400">Auto-generated from monitor target</p>
              </div>

              {/* Threshold | Severity | Interval — 3 cols */}
              <div className="col-span-2 grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="rule-threshold" className="text-[12px] font-medium text-slate-600">
                    {form.alertType === "ssl" ? "Days Until Expiry" : form.alertType === "upstream" ? "Down Count" : "Threshold (%)"}
                  </Label>
                  <Input
                    id="rule-threshold"
                    type="number"
                    value={form.threshold}
                    onChange={e => patch({ threshold: Number(e.target.value) })}
                    className="h-9 text-[13px]"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[12px] font-medium text-slate-600">Alert Severity</Label>
                  <Select value={form.severity} onValueChange={v => patch({ severity: v as any })}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-[13px]">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${SEVERITY_STYLES[o.value]}`}>
                            {o.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="rule-interval" className="text-[12px] font-medium text-slate-600">
                    Evaluation Interval (s)
                  </Label>
                  <Input
                    id="rule-interval"
                    type="number"
                    min="10"
                    max="86400"
                    value={form.checkInterval}
                    onChange={e => patch({ checkInterval: Number(e.target.value) })}
                    className="h-9 text-[13px]"
                  />
                  <p className="text-[11px] text-slate-400">
                    {form.alertType === "ssl" ? "86400s = 1 day" : "CPU/Mem: 30s · Disk: 300s"}
                  </p>
                </div>
              </div>

              {/* Dispatch channels — full width */}
              <div className="col-span-2 grid gap-1.5">
                <Label className="text-[12px] font-medium text-slate-600">Dispatch To</Label>
                {channels.filter(c => c.enabled).length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-1">
                    No active delivery channels — register a channel first
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 p-3 bg-slate-50 rounded-md border border-slate-100">
                    {channels.filter(c => c.enabled).map(ch => (
                      <label key={ch.id} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.channels.includes(ch.id)}
                          onChange={e => {
                            patch({
                              channels: e.target.checked
                                ? [...form.channels, ch.id]
                                : form.channels.filter(c => c !== ch.id)
                            });
                          }}
                          className="w-3.5 h-3.5 rounded accent-slate-700"
                        />
                        <span className="flex items-center gap-1.5 text-[12px] text-slate-700">
                          {ch.type === "email"
                            ? <Mail className="h-3 w-3 text-slate-400" />
                            : <MessageSquare className="h-3 w-3 text-slate-400" />
                          }
                          {ch.name}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {ch.type === "email" ? ch.config.email : ch.config.chatId}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Activate toggle — full width */}
              <div className="col-span-2 flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
                <div>
                  <p className="text-[12px] font-medium text-slate-700">Activate rule</p>
                  <p className="text-[11px] text-slate-400">Enable for immediate enforcement</p>
                </div>
                <Switch
                  id="rule-enabled"
                  checked={form.enabled}
                  onCheckedChange={v => patch({ enabled: v })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} disabled={createRule.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={createRule.isPending}>
                {createRule.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Create Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider pl-5 py-2.5">Rule Label</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Monitor Target</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Trigger Expression</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Severity</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Dispatch Channels</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Interval</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider py-2.5">Active</TableHead>
            <TableHead className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider text-right pr-5 py-2.5">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alertRules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-14 text-center">
                <ShieldAlert className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-[13px] text-slate-400 font-medium">No detection rules configured</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Create a rule to start monitoring your WAF infrastructure</p>
              </TableCell>
            </TableRow>
          ) : alertRules.map(rule => {
            const meta = MONITOR_META[rule.condition?.startsWith("cpu") ? "cpu"
              : rule.condition?.startsWith("memory") ? "memory"
              : rule.condition?.startsWith("disk") ? "disk"
              : rule.condition?.startsWith("upstream") ? "upstream"
              : rule.condition?.startsWith("ssl") ? "ssl"
              : "cpu"];
            const Icon = meta?.icon ?? Bell;
            return (
              <TableRow key={rule.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <TableCell className="font-medium text-[13px] text-slate-800 pl-5 py-3">{rule.name}</TableCell>
                <TableCell className="py-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                    {meta?.label ?? rule.condition}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-slate-500 py-3">
                  {rule.condition} <span className="text-slate-300">|</span> <span className="text-slate-700">{rule.threshold}</span>
                </TableCell>
                <TableCell className="py-3">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_STYLES[rule.severity] || SEVERITY_STYLES.info}`}>
                    {SEVERITY_LABELS[rule.severity] || rule.severity.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {rule.channels.length === 0 ? (
                      <span className="text-[11px] text-slate-300">—</span>
                    ) : rule.channels.map(chId => {
                      const ch = channels.find(c => c.id === chId);
                      return ch ? (
                        <span key={chId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                          {ch.type === "email" ? <Mail className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
                          {ch.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-slate-500 py-3">
                  {fmtInterval(rule.checkInterval ?? 60)}
                </TableCell>
                <TableCell className="py-3">
                  <Switch checked={rule.enabled} onCheckedChange={() => handleToggle(rule.id)} />
                </TableCell>
                <TableCell className="text-right pr-5 py-3">
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                    onClick={() => setToDelete({ id: rule.id, name: rule.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Remove Detection Rule"
        description={
          <>
            Permanently remove rule <strong>{toDelete?.name}</strong>?
            <br />
            Alert monitoring for this condition will cease immediately.
          </>
        }
        confirmText="Remove Rule"
        cancelText="Cancel"
        onConfirm={handleDelete}
        isLoading={deleteRule.isPending}
        variant="destructive"
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const Alerts = () => (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-bold text-slate-800">Alerting</h1>
      <p className="text-[13px] text-slate-400">
        WAF detection rules · Alert dispatch pipelines · Infrastructure health monitoring
      </p>
    </div>

    <Tabs defaultValue="channels" className="space-y-4">
      <TabsList className="bg-slate-100 p-0.5 h-auto">
        <TabsTrigger value="channels" className="text-[12px] px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          Delivery Channels
        </TabsTrigger>
        <TabsTrigger value="rules" className="text-[12px] px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
          Detection Rules
        </TabsTrigger>
      </TabsList>

      <TabsContent value="channels">
        <Suspense fallback={<SkeletonTable rows={4} columns={5} title="Delivery Channels" />}>
          <NotificationChannelsTab />
        </Suspense>
      </TabsContent>

      <TabsContent value="rules">
        <Suspense fallback={<SkeletonTable rows={4} columns={8} title="Detection Rules" />}>
          <AlertRulesTab />
        </Suspense>
      </TabsContent>
    </Tabs>
  </div>
);

export default Alerts;
