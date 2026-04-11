import { useState, useEffect, useCallback } from 'react';
import {
  X, Plus, Trash2, FlaskConical, ChevronDown, ChevronUp,
  GripVertical, Eye, EyeOff, Check, AlertCircle, Loader2,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiService, AiProvider, ProviderPreset, CreateProviderPayload } from '@/services/ai.service';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Provider row ─────────────────────────────────────────────────────────────

interface ProviderRowProps {
  provider: AiProvider;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, patch: Partial<AiProvider> & { apiKey?: string | null }) => Promise<void>;
  onTest: (id: string, baseUrl: string, apiKey: string, model: string) => Promise<void>;
  testState: Record<string, 'idle' | 'loading' | 'ok' | 'fail'>;
}

function ProviderRow({ provider, onToggle, onDelete, onSave, onTest, testState }: ProviderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [label, setLabel] = useState(provider.label);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [model, setModel] = useState(provider.model);
  const [apiKey, setApiKey] = useState('');
  const [priority, setPriority] = useState(String(provider.priority));

  const isDirty =
    label !== provider.label ||
    baseUrl !== provider.baseUrl ||
    model !== provider.model ||
    apiKey !== '' ||
    priority !== String(provider.priority);

  const handleSave = async () => {
    if (!baseUrl || !model) {
      toast.error('Base URL and model are required', { description: 'Please fill all required fields.' });
      return;
    }
    setSaving(true);
    try {
      const patch: any = { label, baseUrl, model, priority: Number(priority) };
      if (apiKey) patch.apiKey = apiKey;
      await onSave(provider.id, patch);
      setApiKey('');
      toast.success('Provider updated');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete provider "${provider.label}"?`)) return;
    setDeleting(true);
    try { await onDelete(provider.id); }
    finally { setDeleting(false); }
  };

  const state = testState[provider.id] ?? 'idle';

  return (
    <div className={cn(
      'border rounded-lg transition-colors',
      provider.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
    )}>
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />

        {/* Enable toggle */}
        <button
          onClick={() => onToggle(provider.id, !provider.enabled)}
          className={cn(
            'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors',
            provider.enabled ? 'bg-blue-600' : 'bg-slate-200'
          )}
        >
          <span className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5',
            provider.enabled ? 'translate-x-4' : 'translate-x-0.5'
          )} />
        </button>

        {/* Label + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', provider.enabled ? 'text-slate-800' : 'text-slate-400')}>
              {provider.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 rounded">
              #{provider.priority}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate font-mono">{provider.model}</div>
        </div>

        {/* Test status badge */}
        {state === 'ok' && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
        {state === 'fail' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
        {state === 'loading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}

        {/* Test button */}
        <button
          onClick={() => onTest(provider.id, baseUrl, apiKey || '', model)}
          disabled={state === 'loading'}
          className="text-[11px] text-slate-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors flex-shrink-0"
          title="Test connection"
        >
          <FlaskConical className="w-3.5 h-3.5" />
        </button>

        {/* Expand */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Display Name</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Priority (lower = first)</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(e.target.value)}
                min={0}
                max={999}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Base URL</label>
            <input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Model</label>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              API Key {provider.apiKey ? '(masked — enter new to change)' : '(optional for local models)'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={provider.apiKey ? '••••••••••••' : 'sk-...'}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 pr-10 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-700 transition-colors"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete provider
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLabel(provider.label); setBaseUrl(provider.baseUrl);
                  setModel(provider.model); setApiKey('');
                  setPriority(String(provider.priority));
                }}
                className="text-[12px] text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded hover:bg-slate-100 transition-colors"
              >
                Revert
              </button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] h-7"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add provider form ────────────────────────────────────────────────────────

interface AddProviderFormProps {
  presets: ProviderPreset[];
  onAdd: (payload: CreateProviderPayload) => Promise<void>;
  onCancel: () => void;
}

function AddProviderForm({ presets, onAdd, onCancel }: AddProviderFormProps) {
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [priority, setPriority] = useState('10');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyPreset = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    setLabel(preset.label);
    setBaseUrl(preset.baseUrl);
    setModel(preset.modelSuggestions[0] ?? '');
    // Generate unique name if custom
    const slug = preset.name === 'custom'
      ? `custom-${Date.now()}`
      : preset.name;
    setName(slug);
  };

  const handleSubmit = async () => {
    if (!name || !label || !baseUrl || !model) {
      toast.error('Missing required fields', { description: 'Name, Label, Base URL, and Model are required.' });
      return;
    }
    setSaving(true);
    try {
      await onAdd({ name, label, baseUrl, apiKey: apiKey || undefined, model, priority: Number(priority), enabled: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/40 p-4 space-y-4">
      <div className="text-sm font-semibold text-slate-700">Add AI Provider</div>

      {/* Preset grid */}
      <div>
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-2">Choose a preset</div>
        <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
          {presets.map(p => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={cn(
                'text-left px-2.5 py-2 rounded border text-[12px] transition-colors',
                selectedPreset?.name === p.name
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              )}
            >
              <div className="font-medium leading-tight">{p.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedPreset && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Internal Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value.replace(/[^a-z0-9-_]/g, ''))}
                placeholder="my-openai"
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Display Label *</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Base URL *</label>
            <input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Model *</label>
              {selectedPreset.modelSuggestions.length > 0 ? (
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {selectedPreset.modelSuggestions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="">-- type custom --</option>
                </select>
              ) : (
                <input
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="model-name"
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              )}
              {model === '' && selectedPreset.modelSuggestions.length > 0 && (
                <input
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="type model name"
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-1"
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(e.target.value)}
                min={0} max={999}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              API Key {!selectedPreset.requiresKey && '(optional)'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={selectedPreset.requiresKey ? 'sk-...' : 'Leave empty for local/no-auth endpoints'}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 pr-10 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button type="button" onClick={() => setShowKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel}
              className="text-[12px] text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] h-7">
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Add provider
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Modal ──────────────────────────────────────────────────────

interface AiProviderSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function AiProviderSettings({ open, onClose }: AiProviderSettingsProps) {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [testState, setTestState] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'fail'>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr] = await Promise.all([aiService.listProviders(), aiService.getPresets()]);
      setProviders(p);
      setPresets(pr);
    } catch {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const updated = await aiService.updateProvider(id, { enabled });
      setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: updated.enabled } : p));
    } catch {
      toast.error('Failed to update provider');
    }
  };

  const handleSave = async (id: string, patch: any) => {
    const updated = await aiService.updateProvider(id, patch);
    setProviders(prev => prev.map(p => p.id === id ? { ...updated } : p));
  };

  const handleDelete = async (id: string) => {
    await aiService.deleteProvider(id);
    setProviders(prev => prev.filter(p => p.id !== id));
    toast.success('Provider deleted');
  };

  const handleTest = async (id: string, baseUrl: string, apiKey: string, model: string) => {
    setTestState(s => ({ ...s, [id]: 'loading' }));
    try {
      const result = await aiService.testProvider({ baseUrl, apiKey: apiKey || undefined, model });
      setTestState(s => ({ ...s, [id]: result.success ? 'ok' : 'fail' }));
      if (result.success) {
        toast.success('Connection successful', { description: result.message });
      } else {
        toast.error('Connection failed', { description: result.message });
      }
    } catch {
      setTestState(s => ({ ...s, [id]: 'fail' }));
      toast.error('Test failed');
    }
    setTimeout(() => setTestState(s => ({ ...s, [id]: 'idle' })), 4000);
  };

  const handleAdd = async (payload: CreateProviderPayload) => {
    const created = await aiService.createProvider(payload);
    setProviders(prev => [...prev, created]);
    setShowAdd(false);
    toast.success('Provider added', { description: 'Enable it to start using it.' });
  };

  if (!open) return null;

  const enabledCount = providers.filter(p => p.enabled).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col z-10 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <Settings2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-800">AI Provider Settings</div>
              <div className="text-[12px] text-slate-400">
                {providers.length} configured · {enabledCount} active
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-600">
          Providers are tried in <strong>priority order</strong> (lowest number first). If one fails, the next enabled provider is tried automatically.
          Supports any <strong>OpenAI-compatible API</strong> — hosted providers, local Ollama, LM Studio, self-hosted vLLM, etc.
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && providers.length === 0 && !showAdd && (
            <div className="text-center py-10 text-slate-400">
              <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <div className="text-sm">No AI providers configured</div>
              <div className="text-[12px] mt-1">Add a provider to enable the AI assistant</div>
            </div>
          )}

          {!loading && providers.map(p => (
            <ProviderRow
              key={p.id}
              provider={p}
              onToggle={handleToggle}
              onSave={handleSave}
              onDelete={handleDelete}
              onTest={handleTest}
              testState={testState}
            />
          ))}

          {showAdd && (
            <AddProviderForm
              presets={presets}
              onAdd={handleAdd}
              onCancel={() => setShowAdd(false)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="text-[11px] text-slate-400">
            API keys are stored in the database and masked in the UI
          </div>
          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] h-7">
              <Plus className="w-3 h-3 mr-1" /> Add Provider
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
