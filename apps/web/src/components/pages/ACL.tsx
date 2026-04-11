import { useState, useEffect, useRef } from "react";
import { toast } from 'sonner';
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Download, Upload, Trash2, Edit, Loader2, AlertCircle, CheckCircle2, Info, FileCode, ShieldCheck, ShieldOff, Zap } from "lucide-react";
import { ACLRule } from "@/types";
import { SkeletonTable } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { validateAclValue, getValidationHints, getExampleValue } from "@/utils/acl-validators";
import { PreviewConfigDialog } from "@/components/acl/PreviewConfigDialog";
import {
  useSuspenseAclRules,
  useCreateAclRule,
  useUpdateAclRule,
  useDeleteAclRule,
  useToggleAclRule,
  useApplyAclRules,
  useImportAclRules,
} from "@/queries";

const LIST_TYPE_LABEL: Record<string, string> = {
  whitelist: "Allowlist",
  blacklist: "Denylist",
};

const ACTION_META: Record<string, { label: string; variant: "default" | "destructive" | "secondary"; icon: React.ReactNode }> = {
  allow:     { label: "Allow",     variant: "default",      icon: <ShieldCheck className="h-3 w-3" /> },
  deny:      { label: "Block 403", variant: "destructive",  icon: <ShieldOff   className="h-3 w-3" /> },
  challenge: { label: "Challenge", variant: "secondary",    icon: <Zap         className="h-3 w-3" /> },
};

const MATCH_TARGET_LABELS: Record<string, string> = {
  ip:          "Source IP / CIDR",
  geoip:       "Geo-Country (ISO 3166)",
  "user-agent": "User-Agent String",
  url:         "Request URI / Path",
  method:      "HTTP Method",
  header:      "Request Header",
};

const MATCH_OPERATOR_LABELS: Record<string, string> = {
  equals:   "Exact Match",
  contains: "Substring Match",
  regex:    "PCRE Regex",
};

function AclRulesTable() {
  const { data: rules } = useSuspenseAclRules();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ACLRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFile, setImportFile] = useState<{ name: string; rules: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createAclRule = useCreateAclRule();
  const updateAclRule = useUpdateAclRule();
  const deleteAclRule = useDeleteAclRule();
  const toggleAclRule = useToggleAclRule();
  const applyAclRules = useApplyAclRules();
  const importAclRules = useImportAclRules();

  const [formData, setFormData] = useState({
    name: "",
    type: "blacklist" as "whitelist" | "blacklist",
    field: "ip" as "ip" | "geoip" | "user-agent" | "url" | "method" | "header",
    operator: "equals" as "equals" | "contains" | "regex",
    value: "",
    action: "deny" as "allow" | "deny" | "challenge",
    enabled: true,
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  useEffect(() => {
    if (formData.value.trim().length === 0) {
      setValidationError(null);
      setValidationSuccess(false);
      return;
    }
    const result = validateAclValue(formData.field, formData.operator, formData.value);
    if (result.valid) { setValidationError(null); setValidationSuccess(true); }
    else { setValidationError(result.error || "Invalid value"); setValidationSuccess(false); }
  }, [formData.value, formData.field, formData.operator]);

  useEffect(() => {
    if (formData.type === "whitelist" && formData.action === "deny")
      setFormData(p => ({ ...p, action: "allow" }));
    else if (formData.type === "blacklist" && formData.action === "allow")
      setFormData(p => ({ ...p, action: "deny" }));
  }, [formData.type]);

  useEffect(() => {
    setValidationError(null);
    setValidationSuccess(false);
    if (formData.value.trim().length > 0) {
      const result = validateAclValue(formData.field, formData.operator, formData.value);
      if (result.valid) setValidationSuccess(true);
      else setValidationError(result.error || "Invalid value");
    }
  }, [formData.field, formData.operator]);

  const handleAddRule = async () => {
    if (!formData.name.trim()) {
      toast.error('Validation Error', { description: "Policy name is required" });
      return;
    }
    if (!formData.value.trim()) {
      toast.error('Validation Error', { description: "Match pattern is required" });
      return;
    }
    const valueValidation = validateAclValue(formData.field, formData.operator, formData.value);
    if (!valueValidation.valid) {
      toast.error('Validation Error', { description: valueValidation.error || "Invalid match pattern" });
      return;
    }
    const conditionField = formData.field.replace("-", "_") as any;
    try {
      if (editingRule) {
        await updateAclRule.mutateAsync({
          id: editingRule.id,
          data: { name: formData.name, type: formData.type, conditionField, conditionOperator: formData.operator, conditionValue: formData.value, action: formData.action, enabled: formData.enabled },
        });
        toast.success('Firewall rule updated');
      } else {
        await createAclRule.mutateAsync({ name: formData.name, type: formData.type, conditionField, conditionOperator: formData.operator, conditionValue: formData.value, action: formData.action, enabled: formData.enabled });
        toast.success('Firewall rule created');
      }
      setIsDialogOpen(false);
      setEditingRule(null);
      resetForm();
    } catch (error: any) {
      toast.error(editingRule ? "Update failed" : "Create failed", { description: error.response?.data?.message || "Operation failed" });
    }
  };

  const resetForm = () => {
    setFormData({ name: "", type: "blacklist", field: "ip", operator: "equals", value: "", action: "deny", enabled: true });
    setValidationError(null);
    setValidationSuccess(false);
  };

  const handleEdit = (rule: ACLRule) => {
    setEditingRule(rule);
    setFormData({ name: rule.name, type: rule.type, field: rule.condition.field, operator: rule.condition.operator, value: rule.condition.value, action: rule.action, enabled: rule.enabled });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    try {
      await deleteAclRule.mutateAsync(ruleToDelete.id);
      toast.success('Firewall rule deleted');
      setRuleToDelete(null);
    } catch (error: any) {
      toast.error('Delete failed', { description: error.response?.data?.message || "Failed to delete rule" });
    }
  };

  const handleToggle = async (id: string) => {
    try { await toggleAclRule.mutateAsync(id); }
    catch (error: any) { toast.error('Toggle failed', { description: error.response?.data?.message || "Failed to toggle rule" }); }
  };

  const handleApplyRules = async () => {
    try {
      const result = await applyAclRules.mutateAsync();
      result.success ? toast.success("Policy committed", { description: result.message }) : toast.error("Commit failed", { description: result.message });
    } catch (error: any) {
      toast.error('Commit failed', { description: error.response?.data?.message || "Failed to commit ACL policy to Nginx" });
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(rules, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `acl-policy-${new Date().toISOString()}.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
    toast.success('Policy exported');
  };

  const handleImportClick = () => {
    setImportFile(null);
    setImportMode('merge');
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const rules = Array.isArray(parsed) ? parsed : parsed.rules ?? parsed.data ?? null;
        if (!Array.isArray(rules)) {
          toast.error('Invalid format', { description: 'JSON must be an array of rules or an object with a "rules" key.' });
          return;
        }
        setImportFile({ name: file.name, rules });
        setImportDialogOpen(true);
      } catch {
        toast.error('Parse error', { description: 'File is not valid JSON.' });
      }
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    try {
      const result = await importAclRules.mutateAsync({ rules: importFile.rules, mode: importMode });
      toast.success(`Imported ${result.imported} rule(s)`, {
        description: result.skipped > 0 ? `${result.skipped} rule(s) skipped due to validation errors.` : undefined,
      });
      setImportDialogOpen(false);
      setImportFile(null);
    } catch (error: any) {
      toast.error('Import failed', { description: error.response?.data?.message || 'Failed to import rules.' });
    }
  };

  const activeRules  = rules.filter(r => r.enabled).length;
  const denyRules    = rules.filter(r => r.action === "deny").length;
  const allowRules   = rules.filter(r => r.action === "allow").length;

  return (
    <>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">IP Firewall</h1>
          <p className="text-[13px] text-slate-400">Enforce allowlist / denylist ACL policies at the nginx ingress layer</p>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={() => setPreviewOpen(true)}>
            <FileCode className="h-3.5 w-3.5 mr-1.5" />
            Preview nginx Config
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={handleImportClick}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>

          <div className="h-5 w-px bg-slate-200" />

          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-[13px]"
            onClick={handleApplyRules}
            disabled={applyAclRules.isPending}
          >
            {applyAclRules.isPending
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            Commit Policy to Nginx
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) { setEditingRule(null); resetForm(); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-[13px]">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Rule
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-[15px]">
                  {editingRule ? "Edit Firewall Rule" : "New Firewall Rule"}
                </DialogTitle>
                <DialogDescription className="text-[12px]">
                  Define an ACL match condition and enforcement action applied at the nginx ingress layer.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4 py-2">

                {/* Policy Name */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px] font-medium">Policy Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Block Tor Exit Nodes"
                    className="h-9 text-[13px]"
                  />
                </div>

                {/* List Type + Enforcement Action */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">List Type</Label>
                    <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whitelist">Allowlist</SelectItem>
                        <SelectItem value="blacklist">Denylist</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-400">Determines default-allow vs default-deny posture</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">Enforcement Action</Label>
                    <Select value={formData.action} onValueChange={(v: any) => setFormData({ ...formData, action: v })}>
                      <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow (pass through)</SelectItem>
                        <SelectItem value="deny">Block — 403 Forbidden</SelectItem>
                        <SelectItem value="challenge">Challenge (JS probe)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-400">nginx response when this rule matches</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 pt-1">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Match Condition</p>
                </div>

                {/* Match Target + Operator + Pattern */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">Match Target</Label>
                    <Select value={formData.field} onValueChange={(v: any) => setFormData({ ...formData, field: v })}>
                      <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ip">Source IP / CIDR</SelectItem>
                        <SelectItem value="geoip">Geo-Country (ISO)</SelectItem>
                        <SelectItem value="user-agent">User-Agent</SelectItem>
                        <SelectItem value="url">Request URI</SelectItem>
                        <SelectItem value="method">HTTP Method</SelectItem>
                        <SelectItem value="header">Request Header</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">Match Operator</Label>
                    <Select value={formData.operator} onValueChange={(v: any) => setFormData({ ...formData, operator: v })}>
                      <SelectTrigger className="h-9 text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Exact Match</SelectItem>
                        <SelectItem value="contains">Substring Match</SelectItem>
                        <SelectItem value="regex">PCRE Regex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[12px] font-medium">Pattern</Label>
                    <div className="relative">
                      <Input
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        placeholder={getExampleValue(formData.field, formData.operator)}
                        className={[
                          "h-9 text-[13px] pr-8",
                          validationError ? "border-red-500" : validationSuccess ? "border-emerald-500" : "",
                        ].join(" ")}
                      />
                      {validationSuccess && formData.value.trim().length > 0 && (
                        <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {validationError && (
                        <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Validation error */}
                {validationError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[12px] text-red-700">{validationError}</p>
                  </div>
                )}

                {/* Hints */}
                <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-slate-500">{getValidationHints(formData.field, formData.operator)}</p>
                </div>

                {/* Activate immediately */}
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-slate-700">Activate rule immediately</p>
                    <p className="text-[11px] text-slate-400">Rule will be enforced after next "Commit Policy to Nginx"</p>
                  </div>
                  <Switch
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[13px]"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={createAclRule.isPending || updateAclRule.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-[13px]"
                  onClick={handleAddRule}
                  disabled={createAclRule.isPending || updateAclRule.isPending || !formData.name.trim() || !formData.value.trim() || !!validationError}
                >
                  {(createAclRule.isPending || updateAclRule.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {editingRule ? "Save Changes" : "Create Rule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex items-center gap-6 px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-500">
        <span><span className="font-semibold text-slate-700">{rules.length}</span> rules total</span>
        <span className="text-slate-300">|</span>
        <span><span className="font-semibold text-emerald-600">{activeRules}</span> active</span>
        <span className="text-slate-300">|</span>
        <span><span className="font-semibold text-red-500">{denyRules}</span> block</span>
        <span className="text-slate-300">|</span>
        <span><span className="font-semibold text-sky-600">{allowRules}</span> allow</span>
      </div>

      {/* ── Rules table ── */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Firewall Rules <span className="ml-1 text-slate-400 font-normal">({rules.length})</span></p>
            <p className="text-[11px] text-slate-400">Evaluated top-to-bottom against every inbound request; first match wins</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Policy Name</TableHead>
              <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">List Type</TableHead>
              <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Match Condition</TableHead>
              <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Action</TableHead>
              <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-[13px] text-slate-400">
                  No firewall rules configured — click <strong>New Rule</strong> to define your first ACL policy.
                </TableCell>
              </TableRow>
            )}
            {rules.map((rule) => {
              const actionMeta = (ACTION_META[rule.action] ?? ACTION_META['deny'])!;
              return (
                <TableRow key={rule.id} className="text-[13px]">
                  <TableCell className="font-medium text-slate-800">{rule.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={rule.type === "whitelist" ? "default" : "destructive"}
                      className="text-[11px] font-medium"
                    >
                      {LIST_TYPE_LABEL[rule.type] ?? rule.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-slate-600">
                    <span className="text-slate-400">{MATCH_TARGET_LABELS[rule.condition.field] ?? rule.condition.field}</span>
                    {" "}
                    <span className="text-slate-500 italic">{MATCH_OPERATOR_LABELS[rule.condition.operator] ?? rule.condition.operator}</span>
                    {" "}
                    <span className="bg-slate-100 px-1 rounded text-slate-700">"{rule.condition.value}"</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionMeta.variant} className="text-[11px] font-medium flex items-center gap-1 w-fit">
                      {actionMeta.icon}
                      {actionMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggle(rule.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(rule)}>
                        <Edit className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:text-red-600"
                        onClick={() => setRuleToDelete({ id: rule.id, name: rule.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!ruleToDelete}
        onOpenChange={(open) => !open && setRuleToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Firewall Rule"
        description={`Are you sure you want to delete "${ruleToDelete?.name}"? This cannot be undone and will take effect after the next policy commit.`}
        confirmText="Delete"
        variant="destructive"
      />

      <PreviewConfigDialog open={previewOpen} onOpenChange={setPreviewOpen} />

      {/* ── Import dialog ── */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) { setImportDialogOpen(false); setImportFile(null); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Import Firewall Rules</DialogTitle>
            <DialogDescription>
              {importFile
                ? `${importFile.rules.length} rule(s) found in "${importFile.name}". Choose how to apply them.`
                : 'Choose an import mode.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`flex flex-col gap-1 rounded-md border p-3 text-left text-[13px] transition-colors ${
                  importMode === 'merge'
                    ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="font-medium text-slate-800">Merge</span>
                <span className="text-slate-500">Add imported rules to existing ones</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`flex flex-col gap-1 rounded-md border p-3 text-left text-[13px] transition-colors ${
                  importMode === 'replace'
                    ? 'border-red-600 bg-red-50 ring-1 ring-red-600'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="font-medium text-slate-800">Replace</span>
                <span className="text-slate-500">Delete all existing rules first</span>
              </button>
            </div>
            {importMode === 'replace' && (
              <p className="text-[12px] text-red-600">All current firewall rules will be permanently deleted before import.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setImportDialogOpen(false); setImportFile(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={importMode === 'replace' ? 'destructive' : 'default'}
              disabled={importAclRules.isPending}
              onClick={handleImportConfirm}
            >
              {importAclRules.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              {importMode === 'replace' ? 'Replace & Import' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ACL = () => (
  <div className="space-y-4">
    <Suspense fallback={<SkeletonTable rows={8} columns={6} title="Firewall Rules" />}>
      <AclRulesTable />
    </Suspense>
  </div>
);

export default ACL;
