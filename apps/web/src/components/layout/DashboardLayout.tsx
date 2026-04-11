import { ReactNode, useState, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
import { DashboardHeader } from './DashboardHeader';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { QuickActionDial } from '@/components/ui/QuickActionDial';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function DashboardLayout({ children, title, breadcrumbs }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <DashboardHeader
          title={title}
          breadcrumbs={breadcrumbs}
          onSearchOpen={() => setCmdOpen(true)}
        />
        <main className="flex-1 overflow-auto px-6 pt-4 pb-6">
          {children}
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <QuickActionDial />
    </div>
  );
}
