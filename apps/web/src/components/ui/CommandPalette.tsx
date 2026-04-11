import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';
import {
  LayoutGrid, Globe, KeyRound, ShieldCheck, UserCheck, ListFilter,
  ScrollText, TriangleAlert, BarChart3, Network, HardDrive, UserCog,
  Server, Search, ArrowRight, Shield, Zap, FileText, CornerDownLeft,
  Hash, Command,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: 'navigate' | 'action';
  shortcut?: string;
  action: () => void;
}

const NAV_ITEMS = [
  { label: 'Overview',        description: 'Dashboard & real-time metrics',   icon: LayoutGrid, path: '/dashboard' },
  { label: 'Protected Sites', description: 'Manage domains and origin servers', icon: Globe,      path: '/sites' },
  { label: 'WAF Rules',       description: 'ModSecurity rule management',       icon: ShieldCheck, path: '/waf' },
  { label: 'IP Firewall',     description: 'Block & allow IP addresses',        icon: UserCheck,  path: '/ip-firewall' },
  { label: 'Access Policies', description: 'IP allowlist and basic auth policies',  icon: ListFilter, path: '/access-policies' },
  { label: 'SSL / TLS',       description: 'Certificate management',            icon: KeyRound,   path: '/ssl' },
  { label: 'Load Balancing',  description: 'Upstream servers and health',       icon: Network,    path: '/load-balancing' },
  { label: 'Logs',            description: 'Access and error logs',             icon: ScrollText, path: '/logs' },
  { label: 'Alerting',        description: 'Detection rules · Notification channels',  icon: TriangleAlert, path: '/alerting' },
  { label: 'Performance',     description: 'Response time and metrics',         icon: BarChart3,  path: '/performance' },
  { label: 'Backup',          description: 'Configuration backup and restore',  icon: HardDrive,  path: '/backup' },
  { label: 'Operators',       description: 'Operator accounts and access control', icon: UserCog,    path: '/operators' },
  { label: 'Nodes',           description: 'WAF cluster replica nodes',           icon: Server,     path: '/nodes' },
];

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const buildItems = useCallback((): CommandItem[] => {
    const nav: CommandItem[] = NAV_ITEMS.map(n => ({
      id: `nav-${n.path}`,
      label: n.label,
      description: n.description,
      icon: n.icon,
      category: 'navigate' as const,
      action: () => { router.navigate({ to: n.path }); onClose(); },
    }));

    const actions: CommandItem[] = [
      {
        id: 'action-add-site',
        label: 'Add Protected Site',
        description: 'Register a new domain to protect',
        icon: Globe,
        category: 'action',
        shortcut: 'N',
        action: () => { router.navigate({ to: '/sites' }); onClose(); },
      },
      {
        id: 'action-block-ip',
        label: 'Block an IP Address',
        description: 'Immediately block traffic from an IP',
        icon: Shield,
        category: 'action',
        shortcut: 'B',
        action: () => { router.navigate({ to: '/ip-firewall' }); onClose(); },
      },
      {
        id: 'action-view-logs',
        label: 'View Live Logs',
        description: 'Tail real-time nginx access & error logs',
        icon: ScrollText,
        category: 'action',
        shortcut: 'L',
        action: () => { router.navigate({ to: '/logs' }); onClose(); },
      },
      {
        id: 'action-waf-rules',
        label: 'Manage WAF Rules',
        description: 'Enable or disable ModSecurity rules',
        icon: Zap,
        category: 'action',
        shortcut: 'W',
        action: () => { router.navigate({ to: '/waf' }); onClose(); },
      },
      {
        id: 'action-alerts',
        label: 'Open Alerting',
        description: 'Detection rules and notification channels',
        icon: TriangleAlert,
        category: 'action',
        shortcut: 'A',
        action: () => { router.navigate({ to: '/alerting' }); onClose(); },
      },
      {
        id: 'action-report',
        label: 'Performance Report',
        description: 'View response time and throughput metrics',
        icon: FileText,
        category: 'action',
        action: () => { router.navigate({ to: '/performance' }); onClose(); },
      },
    ];

    return [...actions, ...nav];
  }, [router, onClose]);

  const filtered = buildItems().filter(item =>
    fuzzyMatch(item.label, query) || fuzzyMatch(item.description ?? '', query)
  );

  const grouped = {
    action: filtered.filter(i => i.category === 'action'),
    navigate: filtered.filter(i => i.category === 'navigate'),
  };

  const flat = [...grouped.action, ...grouped.navigate];

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-active="true"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[activeIdx]?.action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  let globalIdx = 0;

  function Section({ title, items }: { title: string; items: CommandItem[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {title}
        </div>
        {items.map(item => {
          const idx = globalIdx++;
          const isActive = idx === activeIdx;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              data-active={isActive}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={item.action}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors rounded-lg mx-1',
                isActive ? 'bg-primary/8 text-slate-800' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <span className={[
                'flex items-center justify-center h-7 w-7 rounded-md flex-shrink-0',
                isActive ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
              ].join(' ')}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium truncate">{item.label}</span>
                {item.description && (
                  <span className="block text-[11px] text-slate-400 truncate">{item.description}</span>
                )}
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {item.shortcut && (
                  <kbd className="h-5 px-1.5 text-[10px] font-mono font-medium rounded bg-slate-100 text-slate-400 border border-slate-200">
                    {item.shortcut}
                  </kbd>
                )}
                {isActive && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions, commands…"
            className="flex-1 text-[14px] text-slate-700 placeholder-slate-400 bg-transparent outline-none"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <kbd className="h-5 px-1 text-[10px] font-mono rounded bg-slate-100 text-slate-400 border border-slate-200 flex items-center">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1.5 px-1">
          {flat.length === 0 ? (
            <div className="py-10 text-center">
              <Hash className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No results for <strong>"{query}"</strong></p>
            </div>
          ) : (
            <>
              <Section title="Quick Actions" items={grouped.action} />
              <Section title="Navigation" items={grouped.navigate} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 bg-slate-50/80">
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <kbd className="h-4 px-1 text-[9px] font-mono rounded bg-white border border-slate-200">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <kbd className="h-4 px-1 text-[9px] font-mono rounded bg-white border border-slate-200 flex items-center gap-0.5">
              <CornerDownLeft className="h-2.5 w-2.5" />
            </kbd>
            select
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
            <Command className="h-3 w-3" />
            <span>K</span>
            <span>to toggle</span>
          </span>
        </div>
      </div>
    </div>
  );
}
