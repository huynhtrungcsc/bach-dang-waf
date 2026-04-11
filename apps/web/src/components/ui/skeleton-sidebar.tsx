import { Skeleton } from "./skeleton";

interface SkeletonSidebarProps {
  className?: string;
  collapsed?: boolean;
}

const groupSizes = [1, 3, 3, 3, 3];

export function SkeletonSidebar({ className, collapsed = false }: SkeletonSidebarProps) {
  return (
    <aside
      className={className}
      style={{
        width: collapsed ? 56 : 220,
        background: '#0f1923',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        flexShrink: 0,
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          height: 48,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 10,
        }}
      >
        <Skeleton className="h-7 w-7 flex-shrink-0 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
        {!collapsed && <Skeleton className="h-4 w-28 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />}
      </div>

      {/* Nav groups skeleton */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {groupSizes.map((count, gi) => (
          <div key={gi} style={{ marginBottom: 16 }}>
            {!collapsed && (
              <div style={{ padding: '0 12px 4px' }}>
                <Skeleton className="h-2 w-16 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            )}
            {collapsed && <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '0 8px 4px' }} />}
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Array.from({ length: count }).map((_, ii) => (
                <div
                  key={ii}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 4,
                  }}
                >
                  <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  {!collapsed && <Skeleton className="h-3 w-20 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer skeleton */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
            }}
          >
            <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            {!collapsed && <Skeleton className="h-3 w-16 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />}
          </div>
        ))}
      </div>
    </aside>
  );
}
