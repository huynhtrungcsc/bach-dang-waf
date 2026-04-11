import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Shield, ShieldCheck, ShieldOff, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomRuleDialog } from '@/components/modsec/CustomRuleDialog';
import { toast } from 'sonner';
import {
  useCrsRules,
  useModSecRules,
  useGlobalModSecSettings,
  useToggleCrsRule,
  useToggleModSecRule,
  useSetGlobalModSec,
  useDeleteModSecRule,
} from '@/queries/modsec.query-options';
import type { ModSecurityCustomRule } from '@/types';

export default function ModSecurity() {
  const { t } = useTranslation();
  const [customRuleDialogOpen, setCustomRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ModSecurityCustomRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  
  // Queries
  const { data: crsRules = [] } = useCrsRules();
  const { data: customRules = [] } = useModSecRules();
  const { data: globalSettings } = useGlobalModSecSettings();
  
  // Mutations
  const toggleCrsRuleMutation = useToggleCrsRule();
  const toggleCustomRuleMutation = useToggleModSecRule();
  const setGlobalModSecMutation = useSetGlobalModSec();
  const deleteCustomRuleMutation = useDeleteModSecRule();
  
  const globalModSecEnabled = globalSettings?.enabled ?? true;

  const handleGlobalToggle = async (enabled: boolean) => {
    try {
      await setGlobalModSecMutation.mutateAsync(enabled);
      toast.success(`ModSecurity globally ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update global ModSecurity setting');
    }
  };

  const handleCRSRuleToggle = async (ruleFile: string, name: string, currentState: boolean) => {
    try {
      await toggleCrsRuleMutation.mutateAsync({ ruleFile });
      toast.success(`Rule "${name}" ${!currentState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const handleCustomRuleToggle = async (id: string, name: string, currentState: boolean) => {
    try {
      await toggleCustomRuleMutation.mutateAsync(id);
      toast.success(`Rule "${name}" ${!currentState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const handleEditRule = (rule: ModSecurityCustomRule) => {
    setEditingRule(rule);
    setCustomRuleDialogOpen(true);
  };

  const handleDeleteRule = async () => {
    if (!deletingRuleId) return;

    try {
      await deleteCustomRuleMutation.mutateAsync(deletingRuleId);
      toast.success('Custom rule deleted successfully');
      setDeletingRuleId(null);
    } catch (error) {
      toast.error('Failed to delete custom rule');
    }
  };

  const handleDialogClose = (open: boolean) => {
    setCustomRuleDialogOpen(open);
    if (!open) {
      setEditingRule(null);
    }
  };

  const crsEnabled  = crsRules.filter(r => r.enabled).length;
  const crsDisabled = crsRules.filter(r => !r.enabled).length;

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('modsec.title')}</h1>
          <p className="text-sm text-slate-400">ModSecurity · OWASP CRS · Custom rules</p>
        </div>
      </div>

      {/* ── Stat summary ── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Global Status</span>
            {globalModSecEnabled
              ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
              : <ShieldOff className="h-4 w-4 text-slate-300" />}
          </div>
          <div className={`text-2xl font-bold leading-none ${globalModSecEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            {globalModSecEnabled ? 'Active' : 'Off'}
          </div>
          <p className="text-xs text-slate-400">Protection state</p>
        </div>

        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">CRS Rules</span>
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-slate-800 leading-none">{crsRules.length}</div>
          <p className="text-xs text-slate-400">OWASP rule sets</p>
        </div>

        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">CRS Enabled</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 leading-none">{crsEnabled}</div>
          <p className="text-xs text-slate-400">{crsDisabled} disabled</p>
        </div>

        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex flex-col gap-2 hover:border-slate-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Custom Rules</span>
            <ListChecks className="h-4 w-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 leading-none">{customRules.length}</div>
          <p className="text-xs text-slate-400">User-defined</p>
        </div>
      </div>

      {/* ── Global toggle strip ── */}
      <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {globalModSecEnabled
            ? <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            : <ShieldOff className="h-5 w-5 text-slate-300 flex-shrink-0" />}
          <div>
            <Label htmlFor="global-modsec" className="text-sm font-semibold text-slate-800 cursor-pointer">
              {t('modsec.global')}
            </Label>
            <p className="text-xs text-slate-400 mt-0.5">
              {globalModSecEnabled
                ? 'All sites with ModSecurity enabled are actively protected'
                : 'ModSecurity is globally disabled — all sites are unprotected'}
            </p>
          </div>
        </div>
        <Switch
          id="global-modsec"
          checked={globalModSecEnabled}
          onCheckedChange={handleGlobalToggle}
        />
      </div>

      {/* ── Rules panel ── */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <Tabs defaultValue="crs" className="w-full">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-800">ModSecurity Rules</p>
              <p className="text-xs text-slate-400">Manage OWASP CRS and custom rule sets</p>
            </div>
            <TabsList className="h-8 text-xs">
              <TabsTrigger value="crs" className="text-xs px-3">CRS Rules (OWASP)</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs px-3">Custom Rules</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="crs" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider pl-5">Rule Name</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Description</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-right pr-5">Enable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crsRules.map((rule) => (
                  <TableRow key={rule.ruleFile} className="border-slate-50 hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-800 pl-5">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-500">{rule.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-xs truncate">{rule.description}</TableCell>
                    <TableCell className="text-right pr-5">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleCRSRuleToggle(rule.ruleFile, rule.name, rule.enabled)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="custom" className="mt-0">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50">
              <p className="text-xs text-slate-400">{customRules.length} rule{customRules.length !== 1 ? 's' : ''} defined</p>
              <button
                onClick={() => setCustomRuleDialogOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:bg-primary/90 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Add Custom Rule
              </button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider pl-5">Rule Name</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Description</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-right">Enable</TableHead>
                  <TableHead className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-right pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14 text-center">
                      <ListChecks className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 font-medium">No custom rules yet</p>
                      <p className="text-xs text-slate-300 mt-0.5">Click "Add Custom Rule" to define your first rule</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  customRules.map((rule) => (
                    <TableRow key={rule.id} className="border-slate-50 hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-800 pl-5">{rule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-500">{rule.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 max-w-xs truncate">{rule.description}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleCustomRuleToggle(rule.id, rule.name, rule.enabled)}
                        />
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingRuleId(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>

      <CustomRuleDialog
        open={customRuleDialogOpen}
        onOpenChange={handleDialogClose}
        editRule={editingRule}
      />

      <AlertDialog open={!!deletingRuleId} onOpenChange={(open) => !open && setDeletingRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this custom rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
