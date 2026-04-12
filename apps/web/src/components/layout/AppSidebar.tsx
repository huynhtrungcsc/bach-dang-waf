import { Link, useMatchRoute } from '@tanstack/react-router';
import { useAuth } from '@/auth';
import { useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/ui/BrandLogo';
import {
  LayoutGrid,
  Globe,
  KeyRound,
  ShieldCheck,
  UserCheck,
  ListFilter,
  ScrollText,
  TriangleAlert,
  BarChart3,
  Network,
  HardDrive,
  UserCog,
  Server,
  LogOut,
  Settings,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const NAV_CONFIG = [
  { key: 'nav.dashboard',       icon: LayoutGrid,   path: '/dashboard' },
  { key: 'nav.domains',         icon: Globe,         path: '/sites' },
  { key: 'nav.modsecurity',     icon: ShieldCheck,   path: '/waf' },
  { key: 'nav.acl',             icon: UserCheck,     path: '/ip-firewall' },
  { key: 'nav.access-policies', icon: ListFilter,    path: '/access-policies' },
  { key: 'nav.ssl',             icon: KeyRound,      path: '/ssl' },
  { key: 'nav.network',         icon: Network,       path: '/load-balancing' },
  { key: 'nav.logs',            icon: ScrollText,    path: '/logs' },
  { key: 'nav.alerts',          icon: TriangleAlert, path: '/alerting' },
  { key: 'nav.performance',     icon: BarChart3,     path: '/performance' },
  { key: 'nav.backup',          icon: HardDrive,     path: '/backup' },
  { key: 'nav.users',           icon: UserCog,       path: '/operators' },
  { key: 'nav.nodes',           icon: Server,        path: '/nodes' },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const matchRoute = useMatchRoute();
  const isActive = !!matchRoute({ to: item.path, fuzzy: true });
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={[
        'flex items-center rounded-md transition-colors duration-100',
        collapsed
          ? 'justify-center w-10 h-10'
          : 'gap-2.5 px-3 py-2.5 w-full',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
      ].join(' ')}
    >
      <Icon
        className={[
          'flex-shrink-0',
          'h-[18px] w-[18px]',
          isActive ? 'text-primary' : 'text-slate-400',
        ].join(' ')}
      />
      {!collapsed && (
        <span className="text-[13px] font-medium truncate">{item.label}</span>
      )}
    </Link>
  );
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const navItems: NavItem[] = NAV_CONFIG.map(({ key, icon, path }) => ({
    label: t(key),
    icon,
    path,
  }));

  const roleAvatar: Record<string, string> = {
    admin:     "/avatar-admin.png",
    moderator: "/avatar-operator.png",
    viewer:    "/avatar-observer.png",
  };
  const avatarSrc = roleAvatar[user?.role ?? ""] ?? "/avatar-observer.png";

  const handleLogout = async () => {
    await logout();
    await router.invalidate();
    router.navigate({ to: '/login' });
  };

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 bg-slate-50 transition-all duration-200 overflow-hidden"
      style={{ width: collapsed ? 52 : 196 }}
    >
      {/* ── Logo ── */}
      <Link
        to="/dashboard"
        className={[
          'flex items-center flex-shrink-0 h-12',
          collapsed ? 'justify-center' : 'px-4 gap-2.5',
        ].join(' ')}
      >
        <BrandMark size={28} variant="dark" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-slate-800 text-[13px] font-bold tracking-wide leading-none truncate">
              BACH DANG WAF
            </div>
          </div>
        )}
      </Link>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className={['flex flex-col gap-1.5', collapsed ? 'items-center px-1.5' : 'px-2'].join(' ')}>
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div className="flex-shrink-0">
        <div className={['flex flex-col gap-1 p-2', collapsed ? 'items-center' : ''].join(' ')}>
          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title={collapsed ? user?.username : undefined}
                className={[
                  'flex items-center rounded-md text-[13px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors',
                  collapsed ? 'justify-center w-10 h-10' : 'gap-2.5 px-3 py-2 w-full',
                ].join(' ')}
              >
                <span className="flex items-center justify-center h-6 w-6 rounded bg-slate-100 flex-shrink-0 select-none overflow-hidden">
                  <img src={avatarSrc} alt={user?.role ?? ""} className="h-4 w-4 object-contain opacity-60" />
                </span>
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-slate-700 text-[12px] font-medium truncate">{user?.username}</div>
                      <div className="text-[10px] text-slate-400 truncate">{{ admin: 'Administrator', moderator: 'Operator', viewer: 'Observer' }[user?.role as string ?? ''] ?? user?.role}</div>
                    </div>
                    <ChevronsUpDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-48">
              {user && (
                <div className="px-2 py-1.5 border-b border-border mb-1">
                  <p className="text-sm font-medium">{user.fullName || user.username}</p>
                  <p className="text-xs text-muted-foreground">{{ admin: 'Administrator', moderator: 'Operator', viewer: 'Observer' }[user.role] ?? user.role}</p>
                </div>
              )}
              <DropdownMenuItem onClick={() => router.navigate({ to: '/account' })}>
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Collapse toggle ── */}
        <div className="px-2 pb-2">
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'flex items-center rounded-md text-[13px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors',
              collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-2.5 px-3 py-2 w-full',
            ].join(' ')}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Collapse</span>
                </>
            }
          </button>
        </div>
      </div>
    </aside>
  );
}
