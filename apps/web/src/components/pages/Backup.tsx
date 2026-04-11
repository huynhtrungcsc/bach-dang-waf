import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Download, Upload, Play, Trash2, Calendar, FileArchive,
  Loader2, RefreshCw, HardDrive, ShieldAlert, Info, Clock,
  CheckCircle2, XCircle, AlertCircle, Circle,
} from "lucide-react";
import { backupService, BackupSchedule, BackupFile } from "@/services/backup.service";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  success:  { label: "COMPLETED", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed:   { label: "FAILED",    cls: "bg-red-50 text-red-700 border border-red-200",           icon: <XCircle className="h-3 w-3" /> },
  running:  { label: "RUNNING",   cls: "bg-blue-50 text-blue-700 border border-blue-200",         icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pending:  { label: "SCHEDULED", cls: "bg-slate-50 text-slate-600 border border-slate-200",      icon: <Circle className="h-3 w-3" /> },
};

const CRON_PRESETS = [
  { label: "Every hour",      value: "0 * * * *" },
  { label: "Every 6 hours",   value: "0 */6 * * *" },
  { label: "Daily at 02:00",  value: "0 2 * * *" },
  { label: "Daily at 04:00",  value: "0 4 * * *" },
  { label: "Weekly (Mon 02:00)", value: "0 2 * * 1" },
  { label: "Custom",          value: "__custom__" },
];

function StatusBadge({ status }: { status: string }) {
  const m = (STATUS_META[status] ?? STATUS_META['pending'])!;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const Backup = () => {
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState(false);
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [form, setForm] = useState({ name: "", preset: "0 2 * * *", custom: "", enabled: true });

  const effectiveCron = form.preset === "__custom__" ? form.custom : form.preset;

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    try {
      setSchedules(await backupService.getSchedules());
    } catch { toast.error("Failed to load backup schedules"); }
    finally { setLoadingSchedules(false); }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      setFiles(await backupService.getFiles());
    } catch { /* files may not exist yet */ }
    finally { setLoadingFiles(false); }
  }, []);

  useEffect(() => { loadSchedules(); loadFiles(); }, [loadSchedules, loadFiles]);

  const handleCreateSchedule = async () => {
    if (!form.name.trim()) return toast.error("Schedule name is required");
    if (!effectiveCron.trim()) return toast.error("Cron expression is required");
    try {
      await backupService.createSchedule({ name: form.name, schedule: effectiveCron, enabled: form.enabled });
      setScheduleDialog(false);
      setForm({ name: "", preset: "0 2 * * *", custom: "", enabled: true });
      loadSchedules();
      toast.success("Backup job created");
    } catch (e: any) { toast.error("Failed to create schedule", { description: e.response?.data?.message }); }
  };

  const handleToggle = async (id: string) => {
    try {
      await backupService.toggleSchedule(id);
      loadSchedules();
    } catch (e: any) { toast.error("Failed to update schedule", { description: e.response?.data?.message }); }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    try {
      await backupService.deleteSchedule(deleteScheduleId);
      setDeleteScheduleId(null);
      loadSchedules();
      toast.success("Backup job removed");
    } catch (e: any) { toast.error("Failed to delete schedule", { description: e.response?.data?.message }); }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    toast.info("Snapshot capture started…");
    try {
      const result = await backupService.runNow(id);
      loadSchedules();
      loadFiles();
      toast.success("Snapshot captured", { description: `${result.filename} · ${result.size}` });
    } catch (e: any) { toast.error("Snapshot failed", { description: e.response?.data?.message }); }
    finally { setRunningId(null); }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const blob = await backupService.exportConfig();
      const ts = new Date().toISOString().replace(/:/g, "-").split(".")[0];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `waf-snapshot-${ts}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Configuration snapshot exported");
    } catch (e: any) { toast.error("Export failed", { description: e.response?.data?.message }); }
    finally { setExportLoading(false); }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".json")) return toast.error("Only .json snapshot files are accepted");
    setPendingFile(file);
    setImportWarning(false);
    setImportConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    setImportLoading(true);
    setImportConfirm(false);
    try {
      const data = JSON.parse(await pendingFile.text());
      const r = await backupService.importConfig(data);
      toast.success("Restore completed", {
        description: `Domains: ${r.domains} · SSL: ${r.ssl} · WAF Rules: ${r.modsecCRS + r.modsecCustom} · ACL: ${r.acl} · Users: ${r.users}`,
        duration: 10000,
      });
      loadSchedules();
    } catch (e: any) {
      toast.error("Restore failed", { description: e.response?.data?.message || "Invalid snapshot file" });
    } finally {
      setImportLoading(false);
      setPendingFile(null);
    }
  };

  const handleDownloadFile = async (id: string, filename: string) => {
    setDownloadingId(id);
    try {
      const blob = await backupService.downloadFile(id);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Download failed"); }
    finally { setDownloadingId(null); }
  };

  const handleDeleteFile = async () => {
    if (!deleteFileId) return;
    try {
      await backupService.deleteFile(deleteFileId);
      setDeleteFileId(null);
      loadFiles();
      toast.success("Snapshot file deleted");
    } catch { toast.error("Failed to delete file"); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Configuration Backup</h1>
          <p className="text-sm text-slate-400 mt-0.5">Snapshot, schedule, and restore WAF configuration state</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => { loadSchedules(); loadFiles(); }}
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Snapshot Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Export */}
        <div className="bg-white border border-slate-100 rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
              <Download className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Export Snapshot</h2>
              <p className="text-xs text-slate-400">Download full configuration state as JSON</p>
            </div>
          </div>
          <div className="text-xs text-slate-500 space-y-1 leading-relaxed">
            <p>Captures all protected sites, SSL certificates, WAF rules (CRS + custom), access policies, alerting config, and system settings into a portable snapshot file.</p>
          </div>
          <Button onClick={handleExport} disabled={exportLoading} className="mt-auto">
            {exportLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Exporting…</> : <><Download className="h-3.5 w-3.5 mr-2" />Export Configuration</>}
          </Button>
        </div>

        {/* Import / Restore */}
        <div className="bg-white border border-slate-100 rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-md border border-amber-100">
              <Upload className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Restore from Snapshot</h2>
              <p className="text-xs text-slate-400">Import a previously exported configuration file</p>
            </div>
          </div>
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) { setPendingFile(f); setImportWarning(true); } }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => setImportWarning(true)}
            className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-all ${isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"}`}
          >
            <Upload className={`h-6 w-6 mx-auto mb-1.5 ${isDragging ? "text-blue-500" : "text-slate-300"}`} />
            <p className="text-xs font-medium text-slate-600">{isDragging ? "Drop snapshot file" : "Click or drag & drop"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">JSON snapshot files only · max 50 MB</p>
          </div>
          <Button variant="outline" onClick={() => setImportWarning(true)} disabled={importLoading} className="mt-auto">
            {importLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Restoring…</> : <><Upload className="h-3.5 w-3.5 mr-2" />Select Snapshot File</>}
          </Button>
        </div>
      </div>

      {/* Backup Jobs */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Backup Jobs</h2>
            <p className="text-xs text-slate-400 mt-0.5">Scheduled automated snapshot captures</p>
          </div>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setScheduleDialog(true)}>
            <Calendar className="h-3.5 w-3.5" />
            New Backup Job
          </Button>
        </div>

        {loadingSchedules ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-sm">Loading backup jobs…</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <HardDrive className="h-8 w-8 mb-2 text-slate-200" />
            <p className="text-sm">No backup jobs configured</p>
            <p className="text-xs text-slate-300 mt-1">Create a job to automate periodic snapshots</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {["Job Name", "Cron Expression", "Last Run", "Next Run", "Last Status", "Archive Size", "Active", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{s.schedule}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(s.lastRun)}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(s.nextRun)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{s.size || "—"}</td>
                  <td className="px-4 py-3">
                    <Switch checked={s.enabled} onCheckedChange={() => handleToggle(s.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                        title="Run now"
                        disabled={runningId === s.id}
                        onClick={() => handleRunNow(s.id)}
                      >
                        {runningId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                        title="Delete job"
                        onClick={() => setDeleteScheduleId(s.id)}
                      >
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

      {/* Snapshot Archives */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Snapshot Archives</h2>
            <p className="text-xs text-slate-400 mt-0.5">Stored backup files — download or delete individual snapshots</p>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">{files.length} file{files.length !== 1 ? "s" : ""}</span>
        </div>

        {loadingFiles ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /><span className="text-xs">Loading archives…</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <FileArchive className="h-7 w-7 mb-2 text-slate-200" />
            <p className="text-sm">No snapshot archives</p>
            <p className="text-xs text-slate-300 mt-0.5">Run a backup job or export a snapshot to create archives</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {["Filename", "Type", "Size", "Status", "Created", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">{f.filename}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                      {f.type || "manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{f.size}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(f.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                        title="Download"
                        disabled={downloadingId === f.id}
                        onClick={() => handleDownloadFile(f.id, f.filename)}
                      >
                        {downloadingId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                        title="Delete"
                        onClick={() => setDeleteFileId(f.id)}
                      >
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

      {/* Reference Panel */}
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Backup Coverage Reference</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <HardDrive className="h-3.5 w-3.5 text-slate-400" />,
              title: "What gets captured",
              body: "All protected sites, SSL/TLS certificates, WAF rules (CRS + custom), access policies, NLB configs, alerting channels & rules, user accounts, nginx vhost files.",
            },
            {
              icon: <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />,
              title: "Restore behaviour",
              body: "Restoring merges configurations. Existing records with matching IDs are overwritten. Nginx is reloaded automatically after a successful restore.",
            },
            {
              icon: <Info className="h-3.5 w-3.5 text-blue-400" />,
              title: "Best practices",
              body: "Maintain ≥3 versioned snapshots. Test restore procedures in a staging environment. Store snapshots off-host in encrypted cold storage.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-2.5">
              <div className="mt-0.5">{item.icon}</div>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-0.5">{item.title}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Schedule Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Backup Job</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="job-name" className="text-xs font-semibold text-slate-600">Job Name</Label>
              <Input
                id="job-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Nightly Full Snapshot"
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-slate-600">Capture Frequency</Label>
              <Select value={form.preset} onValueChange={(v) => setForm({ ...form, preset: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.preset === "__custom__" && (
              <div className="grid gap-1.5">
                <Label htmlFor="cron-expr" className="text-xs font-semibold text-slate-600">Cron Expression</Label>
                <Input
                  id="cron-expr"
                  value={form.custom}
                  onChange={(e) => setForm({ ...form, custom: e.target.value })}
                  placeholder="0 2 * * *"
                  className="h-8 text-sm font-mono"
                />
                <p className="text-[10px] text-slate-400">Standard 5-field cron syntax: minute hour day month weekday</p>
              </div>
            )}
            {form.preset !== "__custom__" && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded px-3 py-2">
                <Clock className="h-3 w-3 text-slate-400" />
                <span className="text-[11px] text-slate-500 font-mono">{effectiveCron}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="job-enabled" className="text-xs font-semibold text-slate-600">Activate on creation</Label>
              <Switch
                id="job-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScheduleDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateSchedule}>Create Job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Warning Dialog */}
      <Dialog open={importWarning} onOpenChange={setImportWarning}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-500" />
              Restore Configuration Snapshot
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
              <p className="text-xs font-semibold text-red-800 mb-1">DESTRUCTIVE OPERATION — All existing configuration will be overwritten</p>
              <p className="text-[11px] text-red-700">This action is irreversible without a prior snapshot. Export your current configuration before proceeding.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Scope of replacement</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500">
                {["Protected sites & vhosts", "SSL/TLS certificates", "WAF rules (CRS + custom)", "Access policies (ACL)", "NLB configurations", "Alerting channels & rules", "User accounts", "Nginx global configs"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <div className="h-1 w-1 bg-slate-400 rounded-full" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json,application/json";
                input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSelect(f); };
                input.click();
              }}
              className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-all ${isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
            >
              <Upload className={`h-6 w-6 mx-auto mb-2 ${isDragging ? "text-blue-500" : "text-slate-300"}`} />
              <p className="text-xs font-medium text-slate-600">{isDragging ? "Release to select" : "Click to browse or drag & drop snapshot file"}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">.json files only</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportWarning(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Confirm Dialog */}
      <AlertDialog open={importConfirm} onOpenChange={setImportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Confirm Restore
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to restore from <span className="font-semibold text-slate-700">{pendingFile?.name}</span>. All current configuration will be replaced and nginx will be reloaded. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport} className="bg-amber-600 hover:bg-amber-700">
              Restore Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Schedule Dialog */}
      <AlertDialog open={!!deleteScheduleId} onOpenChange={(o) => !o && setDeleteScheduleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Backup Job</AlertDialogTitle>
            <AlertDialogDescription>This backup job and its configuration will be permanently deleted. Existing archive files are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchedule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete File Dialog */}
      <AlertDialog open={!!deleteFileId} onOpenChange={(o) => !o && setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Snapshot Archive</AlertDialogTitle>
            <AlertDialogDescription>This snapshot file will be permanently deleted from the server. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Backup;
