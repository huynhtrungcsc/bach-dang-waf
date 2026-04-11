import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Server, Link as LinkIcon, RefreshCw, Trash2, CheckCircle2,
  Loader2, KeyRound, Copy,
  Activity, WifiOff, ArrowRightLeft,
} from "lucide-react";
import { systemConfigQueryOptions } from "@/queries/system-config.query-options";
import { replicaQueryOptions } from "@/queries/replica.query-options";
import { systemConfigService } from "@/services/system-config.service";
import { replicaNodeService } from "@/services/replica.service";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ReplicaNode } from "@/types";

export const Route = createFileRoute("/_auth/nodes")({
  component: NodeTopology,
});

// ─── Terminology ─────────────────────────────────────────────────────────────
// Master Mode  → Controller Mode
// Primary Mode && Replica Mode
// Replica Node
// Register     → Enroll
// API Key      → Auth Token
// Config Hash  → Config Fingerprint
// Connect to Master → Pair with Controller
// Sync from Master  → Pull Config
// Push Config to Replica
// Last Seen    → Last Heartbeat

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAgo(d?: string | null) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtFingerprint(h?: string | null) {
  if (!h) return "—";
  return h.slice(0, 12);
}

const NODE_STATUS: Record<string, { dot: string; label: string }> = {
  online:  { dot: "bg-emerald-500", label: "Online" },
  offline: { dot: "bg-red-400",     label: "Offline" },
  syncing: { dot: "bg-blue-400 animate-pulse", label: "Syncing" },
  error:   { dot: "bg-amber-500",   label: "Error" },
};

function NodeStatusDot({ status }: { status: string }) {
  const m = NODE_STATUS[status] ?? { dot: "bg-slate-300", label: status };
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Role Banner (Controller vs Replica) ─────────────────────────────────────

function RoleBanner({
  mode, isConnected, masterHost, masterPort,
  onSwitch, isSwitching,
}: {
  mode: "master" | "slave";
  isConnected?: boolean;
  masterHost?: string;
  masterPort?: number;
  onSwitch: () => void;
  isSwitching: boolean;
}) {
  const isController = mode === "master";
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {isController
          ? <Server className="h-4 w-4 text-slate-500 shrink-0" />
          : <ArrowRightLeft className="h-4 w-4 text-slate-500 shrink-0" />}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {isController ? "Controller Mode" : "Replica Mode"}
            </span>
            {!isController && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] ${isConnected ? "text-emerald-600" : "text-amber-600"}`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
                {isConnected ? `Paired · ${masterHost}:${masterPort}` : "Not paired"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isController
              ? "This node distributes configuration to enrolled replica nodes"
              : "This node receives configuration from a controller node"}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={onSwitch} disabled={isSwitching}>
        {isSwitching
          ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          : isController
            ? <ArrowRightLeft className="h-3 w-3 mr-1.5" />
            : <Server className="h-3 w-3 mr-1.5" />}
        Switch to {isController ? "Replica" : "Controller"} Mode
      </Button>
    </div>
  );
}

// ─── Replica Fleet (Controller mode) ─────────────────────────────────────────

function ReplicaFleet({ systemConfig: _systemConfig }: { systemConfig: any }) {
  const queryClient = useQueryClient();

  const { data: nodes = [], isLoading } = useQuery({
    ...replicaQueryOptions.all,
    refetchInterval: 30_000,
  });

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<{ open: boolean; token: string; nodeName: string }>({ open: false, token: "", nodeName: "" });
  const [tokenCopied, setTokenCopied] = useState(false);
  const [decommissionId, setDecommissionId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", host: "", port: 3001, syncInterval: 60 });
  const resetForm = () => setForm({ name: "", host: "", port: 3001, syncInterval: 60 });

  const enrollMutation = useMutation({
    mutationFn: replicaNodeService.register,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["replica-nodes"] });
      setEnrollOpen(false);
      resetForm();
      setTokenCopied(false);
      setTokenDialog({ open: true, token: data.data.apiKey, nodeName: data.data.name });
    },
    onError: (e: any) => toast.error("Enrollment failed", { description: e.response?.data?.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: replicaNodeService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["replica-nodes"] }); toast.success("Replica decommissioned"); },
    onError: (e: any) => toast.error("Decommission failed", { description: e.response?.data?.message }),
  });

  const handleEnroll = () => {
    if (!form.name || !form.host) return toast.error("Node name and host are required");
    enrollMutation.mutate({ name: form.name, host: form.host, port: form.port, syncInterval: form.syncInterval });
  };

  const handleSync = async (node: ReplicaNode) => {
    setSyncingId(node.id);
    try {
      await replicaNodeService.syncToNode(node.id, {});
      toast.success("Config pushed", { description: `Configuration pushed to ${node.name}` });
      queryClient.invalidateQueries({ queryKey: ["replica-nodes"] });
    } catch (e: any) {
      toast.error("Push failed", { description: e.response?.data?.message });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await replicaNodeService.syncToAll();
      toast.success("Config pushed to all replicas");
      queryClient.invalidateQueries({ queryKey: ["replica-nodes"] });
    } catch (e: any) {
      toast.error("Sync all failed", { description: e.response?.data?.message });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRegenToken = async (node: ReplicaNode) => {
    setRegenId(node.id);
    try {
      const result = await replicaNodeService.regenerateApiKey(node.id);
      const newToken = result?.data?.apiKey;
      if (!newToken) throw new Error("No token returned");
      setTokenCopied(false);
      setTokenDialog({ open: true, token: newToken, nodeName: node.name });
    } catch (e: any) {
      toast.error("Token regeneration failed", { description: e.response?.data?.message || e.message });
    } finally {
      setRegenId(null);
    }
  };

  const handleCopyToken = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(tokenDialog.token);
      else {
        const t = document.createElement("textarea");
        t.value = tokenDialog.token; t.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
        document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
      }
      setTokenCopied(true);
      toast.success("Auth token copied");
    } catch { toast.error("Copy failed — select text manually"); }
  };

  const online = (nodes as ReplicaNode[]).filter((n) => n.status === "online").length;

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Replica Fleet</span>
          {!isLoading && (
            <span className="text-xs text-slate-400">
              {(nodes as ReplicaNode[]).length} enrolled · {online} online
            </span>
          )}
          <div className="flex-1" />
          {(nodes as ReplicaNode[]).length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleSyncAll} disabled={syncingAll}>
              {syncingAll
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              Push Config to All
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700" onClick={() => { resetForm(); setEnrollOpen(true); }}>
            <Server className="h-3 w-3" />
            Enroll Replica
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4 animate-pulse">
                <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-14" /><Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-12 ml-auto" />
              </div>
            ))}
          </div>
        ) : (nodes as ReplicaNode[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <Server className="h-7 w-7 mb-2 text-slate-200" />
            <p className="text-sm">No replica nodes enrolled</p>
            <p className="text-xs mt-0.5">Click "Enroll Replica" to add the first node</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Node</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Endpoint</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Heartbeat</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Config Fingerprint</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Interval</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(nodes as ReplicaNode[]).map((node) => (
                <tr key={node.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">{node.name}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{node.host}:{node.port}</td>
                  <td className="px-4 py-3"><NodeStatusDot status={node.status} /></td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">{fmtAgo(node.lastSeen)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{fmtFingerprint(node.configHash)}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{node.syncInterval ? `${node.syncInterval}s` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Push config"
                        onClick={() => handleSync(node)} disabled={syncingId === node.id}>
                        {syncingId === node.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Regenerate auth token"
                        onClick={() => handleRegenToken(node)} disabled={regenId === node.id}>
                        {regenId === node.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <KeyRound className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" title="Decommission"
                        onClick={() => setDecommissionId(node.id)} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={(o) => { setEnrollOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Enroll Replica Node</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="rn-name" className="text-xs text-slate-600">Node Name</Label>
              <Input id="rn-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="replica-node-01" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rn-host" className="text-xs text-slate-600">Host / IP Address</Label>
                <Input id="rn-host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="10.0.1.5" className="h-8 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rn-port" className="text-xs text-slate-600">Port</Label>
                <Input id="rn-port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                  placeholder="3001" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rn-interval" className="text-xs text-slate-600">Sync Interval (seconds)</Label>
              <Input id="rn-interval" type="number" value={form.syncInterval}
                onChange={(e) => setForm({ ...form, syncInterval: Number(e.target.value) })}
                placeholder="60" className="h-8 text-sm" />
              <p className="text-[11px] text-slate-400">How often the replica pulls configuration. Minimum 10 s.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-slate-800 hover:bg-slate-700" onClick={handleEnroll} disabled={enrollMutation.isPending}>
              {enrollMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Enrolling…</> : "Enroll Replica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Token reveal Dialog */}
      <Dialog open={tokenDialog.open} onOpenChange={(o) => { if (!o) { setTokenDialog({ open: false, token: "", nodeName: "" }); setTokenCopied(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-slate-500" />
              Auth Token — Copy Before Closing
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-slate-600">
              Auth token for <strong>{tokenDialog.nodeName}</strong>. Shown once only — store it securely.
            </p>
            <div className="border border-slate-200 rounded-md p-3 bg-slate-50 space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Node Auth Token</p>
              <div className="flex gap-2">
                <input type="text" value={tokenDialog.token} readOnly onClick={(e) => e.currentTarget.select()}
                  className="flex-1 font-mono text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleCopyToken}>
                  {tokenCopied ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
              Transmit via secure channel only. This value cannot be retrieved after closing.
            </p>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => { setTokenDialog({ open: false, token: "", nodeName: "" }); setTokenCopied(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decommission confirm */}
      <Dialog open={!!decommissionId} onOpenChange={(o) => { if (!o) setDecommissionId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Decommission Replica</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Remove this replica node? Its auth token will be invalidated and config sync will cease. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDecommissionId(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => { if (decommissionId) { deleteMutation.mutate(decommissionId); setDecommissionId(null); } }}>
              {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Decommission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Replica Connection Panel (Replica mode) ──────────────────────────────────

function ReplicaConnectionPanel({ systemConfig }: { systemConfig: any }) {
  const queryClient = useQueryClient();
  const [pairOpen, setPairOpen] = useState(false);
  const [unpairOpen, setUnpairOpen] = useState(false);
  const [form, setForm] = useState({ masterHost: "", masterPort: 3001, masterApiKey: "", syncInterval: 60 });

  const connectMutation = useMutation({
    mutationFn: systemConfigService.connectToMaster,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      setPairOpen(false);
      toast.success("Paired with controller", { description: `${data.data.masterHost}:${data.data.masterPort}` });
    },
    onError: (e: any) => toast.error("Pairing failed", { description: e.response?.data?.message }),
  });

  const disconnectMutation = useMutation({
    mutationFn: systemConfigService.disconnectFromMaster,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["system-config"] }); setUnpairOpen(false); toast.success("Unpaired from controller"); },
    onError: (e: any) => toast.error("Unpair failed", { description: e.response?.data?.message }),
  });

  const testMutation = useMutation({
    mutationFn: systemConfigService.testMasterConnection,
    onSuccess: (data) => toast.success("Controller reachable", { description: `Latency ${data.data.latency}ms · ${data.data.masterStatus}` }),
    onError: (e: any) => toast.error("Connection test failed", { description: e.response?.data?.message }),
  });

  const syncMutation = useMutation({
    mutationFn: systemConfigService.syncWithMaster,
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["system-config"] }); toast.success("Config pulled", { description: `${data.data.changesApplied} changes applied` }); },
    onError: (e: any) => toast.error("Pull failed", { description: e.response?.data?.message }),
  });

  const handlePair = () => {
    if (!form.masterHost || !form.masterApiKey) return toast.error("Controller host and auth token are required");
    if (form.syncInterval < 10) return toast.error("Sync interval must be at least 10 seconds");
    connectMutation.mutate(form);
  };

  const isConnected = !!systemConfig?.connected;

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Controller Connection</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upstream controller this replica pulls configuration from</p>
          </div>
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Paired
            </span>
          )}
        </div>

        {!isConnected ? (
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                No controller configured — config sync inactive
              </div>
              <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700" onClick={() => setPairOpen(true)}>
                <LinkIcon className="h-3 w-3" />
                Pair with Controller
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            <div className="grid grid-cols-2 divide-x divide-slate-50">
              {[
                { label: "Controller Endpoint", value: `${systemConfig.masterHost}:${systemConfig.masterPort}`, mono: true },
                { label: "Last Config Pull", value: fmtAgo(systemConfig.lastConnectedAt), mono: false },
              ].map((row) => (
                <div key={row.label} className="px-5 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{row.label}</p>
                  <p className={`text-[13px] text-slate-700 ${row.mono ? "font-mono" : ""}`}>{row.value}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Pull Config
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                {testMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                Verify Connection
              </Button>
              <div className="flex-1" />
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setUnpairOpen(true)} disabled={disconnectMutation.isPending}>
                <WifiOff className="h-3 w-3" />
                Unpair
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pair dialog */}
      <Dialog open={pairOpen} onOpenChange={(o) => { setPairOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Pair with Controller</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ctrl-host" className="text-xs text-slate-600">Controller Host / IP</Label>
                <Input id="ctrl-host" value={form.masterHost} onChange={(e) => setForm({ ...form, masterHost: e.target.value })}
                  placeholder="10.0.0.1" className="h-8 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ctrl-port" className="text-xs text-slate-600">Port</Label>
                <Input id="ctrl-port" type="number" value={form.masterPort}
                  onChange={(e) => setForm({ ...form, masterPort: Number(e.target.value) })}
                  placeholder="3001" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ctrl-token" className="text-xs text-slate-600">Auth Token</Label>
              <Input id="ctrl-token" type="password" value={form.masterApiKey}
                onChange={(e) => setForm({ ...form, masterApiKey: e.target.value })}
                placeholder="Paste token from controller enrollment" className="h-8 text-sm" />
              <p className="text-[11px] text-slate-400">Obtain this token from the Controller when enrolling this replica node.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ctrl-interval" className="text-xs text-slate-600">Pull Interval (seconds)</Label>
              <Input id="ctrl-interval" type="number" value={form.syncInterval}
                onChange={(e) => setForm({ ...form, syncInterval: Number(e.target.value) })}
                placeholder="60" className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPairOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-slate-800 hover:bg-slate-700" onClick={handlePair} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Pairing…</> : "Pair with Controller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unpair confirm */}
      <Dialog open={unpairOpen} onOpenChange={setUnpairOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Unpair from Controller</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Disconnect from the controller node? Automatic config sync will stop. You can re-pair at any time.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUnpairOpen(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}>
              {disconnectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Unpair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page root ───────────────────────────────────────────────────────────────

function NodeTopology() {
  const queryClient = useQueryClient();
  const { data: configData, isLoading } = useQuery(systemConfigQueryOptions.all);
  const systemConfig = configData?.data;
  const currentMode: "master" | "slave" = systemConfig?.nodeMode || "master";

  const switchModeMutation = useMutation({
    mutationFn: systemConfigService.updateNodeMode,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      queryClient.invalidateQueries({ queryKey: ["replica-nodes"] });
      toast.success("Node role updated", { description: `Now operating in ${data.data.nodeMode === "master" ? "Controller" : "Replica"} Mode` });
    },
    onError: (e: any) => toast.error("Role switch failed", { description: e.response?.data?.message }),
  });

  const handleSwitch = () => {
    switchModeMutation.mutate(currentMode === "master" ? "slave" : "master");
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Node Topology</h1>
        <p className="text-sm text-slate-400 mt-0.5">Distributed configuration synchronization across WAF nodes</p>
      </div>

      {/* Role banner */}
      {isLoading ? (
        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex items-center gap-4 animate-pulse">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="space-y-1.5"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-2.5 w-64" /></div>
          <Skeleton className="h-7 w-40 ml-auto" />
        </div>
      ) : (
        <RoleBanner
          mode={currentMode}
          isConnected={!!systemConfig?.connected}
          masterHost={systemConfig?.masterHost ?? undefined}
          masterPort={systemConfig?.masterPort ?? undefined}
          onSwitch={handleSwitch}
          isSwitching={switchModeMutation.isPending}
        />
      )}

      {/* Content conditional on mode */}
      {!isLoading && currentMode === "master" && (
        <ReplicaFleet systemConfig={systemConfig} />
      )}

      {!isLoading && currentMode === "slave" && (
        <ReplicaConnectionPanel systemConfig={systemConfig} />
      )}
    </div>
  );
}
