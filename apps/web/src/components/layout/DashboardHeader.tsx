import { useState } from 'react';
import { Bell, HelpCircle, Search, Keyboard } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DashboardHeaderProps {
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  onSearchOpen?: () => void;
}

const SHORTCUTS: { group: string; items: { key: string; desc: string }[] }[] = [
  {
    group: "Navigation",
    items: [
      { key: "⌘K", desc: "Open command palette" },
      { key: "G then D", desc: "Go to Dashboard" },
      { key: "G then L", desc: "Go to Event Log" },
      { key: "G then P", desc: "Go to Performance" },
      { key: "G then A", desc: "Go to Alerting" },
    ],
  },
  {
    group: "General",
    items: [
      { key: "?", desc: "Show keyboard shortcuts" },
      { key: "Esc", desc: "Close dialog / panel" },
      { key: "⌘R", desc: "Refresh current view" },
    ],
  },
  {
    group: "Tables & Lists",
    items: [
      { key: "↑ / ↓", desc: "Navigate rows" },
      { key: "Enter", desc: "Open selected row" },
      { key: "/", desc: "Focus search filter" },
    ],
  },
];

function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Keyboard className="h-4 w-4 text-slate-400" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            List of available keyboard shortcuts for navigating and using the WAF management console.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                {group.group}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-slate-50">
                    <span className="text-[12px] text-slate-600">{item.desc}</span>
                    <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-slate-400 border-t border-slate-100 pt-3">
          Shortcuts are active when no input field is focused.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardHeader({ onSearchOpen }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <>
      <header className="flex items-center h-12 bg-slate-50 border-b border-slate-100 px-4 flex-shrink-0 gap-3">
        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          {/* Search — wider */}
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors text-[12px] min-w-[240px]"
            title="Search (⌘K)"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="inline-flex h-4 px-1 text-[9px] font-mono rounded bg-slate-100 text-slate-400 border border-slate-200 items-center shrink-0">
              ⌘K
            </kbd>
          </button>

          {/* Help — opens keyboard shortcuts */}
          <button
            onClick={() => setShortcutsOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Notifications — navigates to Alerting */}
          <button
            onClick={() => navigate({ to: '/alerting' })}
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="Alerting"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </header>

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
