import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Plus, Globe, Shield, ScrollText, Zap, X } from 'lucide-react';

const ACTIONS = [
  { label: 'Add Protected Site', icon: Globe,       path: '/sites'       },
  { label: 'Block IP',           icon: Shield,      path: '/ip-firewall' },
  { label: 'Live Logs',          icon: ScrollText,  path: '/logs'        },
  { label: 'WAF Rules',          icon: Zap,         path: '/waf'         },
];

const BUTTON_SIZE = 44;
const STORAGE_KEY = 'qad-pos';

function loadPos() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s) as { x: number; y: number };
  } catch { /* ignore */ }
  return null;
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function QuickActionDial() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ mx: number; my: number; bx: number; by: number } | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    const saved = loadPos();
    if (saved) {
      setPos(saved);
    } else {
      setPos({ x: window.innerWidth - BUTTON_SIZE - 24, y: window.innerHeight - BUTTON_SIZE - 24 });
    }
  }, []);

  // Close dial when clicking outside — does NOT block clicks on underlying elements
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragOrigin.current || !pos) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    const nx = clamp(dragOrigin.current.bx + dx, 8, window.innerWidth - BUTTON_SIZE - 8);
    const ny = clamp(dragOrigin.current.by + dy, 8, window.innerHeight - BUTTON_SIZE - 8);
    setPos({ x: nx, y: ny });
  }, [pos]);

  const onMouseUp = useCallback((e: MouseEvent) => {
    if (dragOrigin.current) {
      if (pos) savePos(pos);
    }
    dragOrigin.current = null;
    setDragging(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    e.stopPropagation();
  }, [pos, onMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    didDrag.current = false;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, bx: pos!.x, by: pos!.y };
    setDragging(true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleClick = () => {
    if (didDrag.current) return;
    setOpen(o => !o);
  };

  const handleAction = (path: string) => {
    router.navigate({ to: path });
    setOpen(false);
  };

  if (!pos) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-40"
      style={{ left: pos.x, top: pos.y, userSelect: 'none' }}
    >
      {/* Action items — fan upward */}
      <div className="absolute bottom-full mb-2 right-0 flex flex-col items-end gap-1.5 pb-1">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon;
          const delay = i * 35;
          return (
            <div
              key={action.path}
              className="flex items-center gap-2"
              style={{
                transform: open ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.9)',
                opacity: open ? 1 : 0,
                pointerEvents: open ? 'auto' : 'none',
                transition: `transform 180ms ${delay}ms cubic-bezier(.34,1.56,.64,1), opacity 150ms ${delay}ms`,
              }}
            >
              <span className="bg-white/90 backdrop-blur-sm text-slate-600 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm border border-slate-200/80 whitespace-nowrap">
                {action.label}
              </span>
              <button
                onClick={() => handleAction(action.path)}
                className="h-9 w-9 rounded-full shadow-md bg-white/80 backdrop-blur-sm border border-slate-200/70 text-slate-500 hover:text-slate-800 hover:bg-white hover:border-slate-300 flex items-center justify-center transition-all duration-150 active:scale-90"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main trigger button */}
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        title={dragging ? undefined : open ? 'Close' : 'Quick Actions (drag to move)'}
        className={[
          'h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95',
          'bg-slate-400/40 hover:bg-slate-400/60 backdrop-blur-md border border-white/50 shadow-md',
          dragging ? 'cursor-grabbing scale-105 shadow-xl' : 'cursor-grab',
          open ? 'ring-1 ring-slate-400/60' : '',
        ].join(' ')}
      >
        <div
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          {open
            ? <X className="h-4 w-4 text-slate-600" />
            : <Plus className="h-4 w-4 text-slate-600" />
          }
        </div>
      </div>
    </div>
  );
}
