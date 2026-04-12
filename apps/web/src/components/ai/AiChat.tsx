import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Loader2, ChevronRight,
  RotateCcw, Settings2, AlertCircle, MessageCircleQuestion,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiService, ChatMessage } from '@/services/ai.service';
import { AiProviderSettings } from './AiProviderSettings';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message extends ChatMessage {
  id: string;
  ts: Date;
  model?: string;
  isError?: boolean;
}

interface PanelPos { x: number; y: number }

const PANEL_W = 420;
const PANEL_H = 580;
const EDGE_GAP = 24;

function defaultPos(): PanelPos {
  return {
    x: Math.max(0, window.innerWidth  - PANEL_W - EDGE_GAP),
    y: Math.max(0, window.innerHeight - PANEL_H - EDGE_GAP),
  };
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'System metrics',    query: 'RAM và CPU hiện tại bao nhiêu?' },
  { label: 'Active WAF rules',  query: 'Hệ thống đang bật những rule WAF nào?' },
  { label: 'Attack events (1h)',query: 'Các cuộc tấn công trong 1 giờ gần đây?' },
  { label: 'Disabled rules',    query: 'Rule nào đang tắt trong hệ thống?' },
  { label: 'SQL injection log', query: 'Cuộc tấn công SQL Injection mới nhất là gì?' },
  { label: 'Protected sites',   query: 'Có bao nhiêu domain đang được bảo vệ?' },
];

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-0.5 py-1 px-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Message row ─────────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const time = msg.ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 items-start">
        <div className="max-w-[82%]">
          <div className="text-[13px] text-slate-700 bg-slate-100 border border-slate-200 rounded px-3 py-2 text-right leading-relaxed">
            {msg.content}
          </div>
          <div className="text-[10px] text-slate-400 text-right mt-0.5 pr-0.5">{time}</div>
        </div>
        <div className="w-5 h-5 rounded bg-slate-200 flex-shrink-0 flex items-center justify-center mt-0.5">
          <span className="text-[9px] font-bold text-slate-500">U</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 mt-0.5 bg-white border border-slate-200 flex items-center justify-center">
        <img src="/bach-dang-waf-logo.png" alt="" className="w-4 h-4 object-contain" />
      </div>
      <div className="max-w-[88%] min-w-0">
        <div className={cn(
          'text-[13px] rounded px-3 py-2.5 border',
          msg.isError
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-white text-slate-800 border-slate-200'
        )}>
          {msg.isError && (
            <div className="flex items-center gap-1.5 mb-1.5 text-red-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Error</span>
            </div>
          )}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p:          ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
              strong:     ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
              em:         ({ children }) => <em className="italic text-slate-700">{children}</em>,
              h1:         ({ children }) => <h1 className="text-[14px] font-bold text-slate-900 mt-2 mb-1 first:mt-0">{children}</h1>,
              h2:         ({ children }) => <h2 className="text-[13px] font-semibold text-slate-800 mt-2 mb-1 first:mt-0 border-b border-slate-100 pb-0.5">{children}</h2>,
              h3:         ({ children }) => <h3 className="text-[13px] font-semibold text-slate-700 mt-1.5 mb-0.5 first:mt-0">{children}</h3>,
              ul:         ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-1.5 pl-1">{children}</ul>,
              ol:         ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-1.5 pl-1">{children}</ol>,
              li:         ({ children }) => <li className="leading-relaxed text-slate-700">{children}</li>,
              pre:        ({ children }) => <>{children}</>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-3 my-1.5 text-slate-600 italic">{children}</blockquote>,
              hr:         () => <hr className="border-slate-200 my-2" />,
              a:          ({ children, href }) => <a href={href} className="text-blue-600 underline underline-offset-2 hover:text-blue-800" target="_blank" rel="noopener noreferrer">{children}</a>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                return isBlock
                  ? <code className="block bg-slate-50 border border-slate-200 rounded px-2.5 py-2 my-1.5 font-mono text-[11px] text-slate-800 whitespace-pre-wrap overflow-x-auto">{children}</code>
                  : <code className="bg-slate-100 rounded px-1 py-0.5 font-mono text-[11px] text-slate-800">{children}</code>;
              },
              table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                  <table className="w-full text-[12px] border-collapse border border-slate-200">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
              tbody: ({ children }) => <tbody className="divide-y divide-slate-200">{children}</tbody>,
              tr:    ({ children }) => <tr className="hover:bg-slate-50">{children}</tr>,
              th:    ({ children }) => <th className="px-2.5 py-1.5 text-left font-semibold text-slate-700 border border-slate-200 whitespace-nowrap">{children}</th>,
              td:    ({ children }) => <td className="px-2.5 py-1.5 text-slate-600 border border-slate-200">{children}</td>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 mt-0.5 pl-0.5">
          <span className="text-[10px] text-slate-400">{time}</span>
          {msg.model && msg.model !== 'guard' && (
            <span className="text-[10px] text-slate-300 font-mono truncate max-w-[200px]">{msg.model}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiChat() {
  const [open, setOpen]               = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [pos, setPos]                 = useState<PanelPos | null>(null);
  const [dragging, setDragging]       = useState(false);

  const { user }  = useAuth();
  const isAdmin   = user?.role === 'admin';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const dragOffset     = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // ── Auto-scroll ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      if (!pos) setPos(defaultPos());
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, messages]);

  // ── Keep panel in viewport on resize ──
  useEffect(() => {
    const onResize = () => {
      setPos(p => {
        if (!p) return p;
        return {
          x: Math.min(p.x, window.innerWidth  - PANEL_W),
          y: Math.min(p.y, window.innerHeight - PANEL_H),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Drag handlers ──
  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(p => {
      const cur = p ?? defaultPos();
      dragOffset.current = { dx: e.clientX - cur.x, dy: e.clientY - cur.y };
      return cur;
    });
  }, []);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const nx = e.clientX - dragOffset.current.dx;
    const ny = e.clientY - dragOffset.current.dy;
    setPos({
      x: Math.max(0, Math.min(nx, window.innerWidth  - PANEL_W)),
      y: Math.max(0, Math.min(ny, window.innerHeight - PANEL_H)),
    });
  }, [dragging]);

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }, []);

  // ── Chat logic ──
  const buildHistory = (): ChatMessage[] =>
    messages.filter(m => !m.isError).slice(-10).map(({ role, content }) => ({ role, content }));

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setShowSuggestions(false);
    setInput('');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await aiService.chat(trimmed, buildHistory());
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: res.reply, ts: new Date(), model: res.model,
      }]);
    } catch (err: any) {
      const errText = err?.response?.data?.message || err?.message || 'Connection failed.';
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: errText, ts: new Date(), isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleClear = () => { setMessages([]); setShowSuggestions(true); setInput(''); };

  const panelPos = pos ?? defaultPos();

  return (
    <>
      {/* ── Floating trigger ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed z-50 w-12 h-12 rounded-full shadow-lg',
          'flex items-center justify-center select-none',
          'transition-colors duration-200',
          open
            ? 'bg-slate-700 hover:bg-slate-600 text-white'
            : 'bg-slate-800 hover:bg-slate-700 text-white',
        )}
        style={{ bottom: EDGE_GAP, right: EDGE_GAP }}
        title="WAF Advisor"
      >
        {open
          ? <X className="w-5 h-5" />
          : <MessageCircleQuestion className="w-5 h-5" />
        }
      </button>

      {/* ── Draggable panel ── */}
      {open && (
        <div
          className="fixed z-40 flex flex-col bg-white border border-slate-200 shadow-2xl shadow-slate-900/15 rounded-sm"
          style={{
            width: PANEL_W,
            height: PANEL_H,
            left: panelPos.x,
            top:  panelPos.y,
            willChange: 'left, top',
          }}
        >
          {/* Header — drag handle */}
          <div
            className={cn(
              'flex items-center justify-between px-4 h-11 border-b border-slate-200 bg-slate-50 flex-shrink-0 rounded-t-sm select-none',
              dragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
          >
            <div className="flex items-center gap-2.5">
              <img src="/bach-dang-waf-logo.png" alt="WAF" className="h-5 w-auto flex-shrink-0" />
              <span className="text-[13px] font-semibold text-slate-700 tracking-tight">WAF Advisor</span>
              <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-px">AI</span>
            </div>
            <div className="flex items-center gap-0.5">
              {isAdmin && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="AI Provider Settings"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Clear session"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
            {messages.length === 0 && showSuggestions && (
              <div className="space-y-3 pt-1">
                <div className="text-[12px] text-slate-500 border border-slate-200 rounded bg-white px-3 py-2.5 leading-relaxed">
                  Hỏi về trạng thái WAF, rule bảo mật, log và phân tích tấn công.
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-0.5 mb-1.5">
                    Suggested queries
                  </div>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s.query}
                      onClick={() => sendMessage(s.query)}
                      className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-colors group"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                      <div>
                        <div className="text-[12px] font-medium text-slate-600 group-hover:text-slate-800">{s.label}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.query}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}

            {loading && (
              <div className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 mt-0.5 bg-white border border-slate-200 flex items-center justify-center">
                  <img src="/bach-dang-waf-logo.png" alt="" className="w-4 h-4 object-contain" />
                </div>
                <div className="bg-white border border-slate-200 rounded px-3 py-2">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white px-3 py-2.5 flex-shrink-0">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập câu hỏi..."
                  disabled={loading}
                  rows={1}
                  className={cn(
                    'w-full resize-none rounded border border-slate-200 bg-slate-50',
                    'px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400',
                    'focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400',
                    'disabled:opacity-50 overflow-y-auto',
                  )}
                  style={{ lineHeight: '1.5', maxHeight: 112 }}
                  onInput={e => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 112) + 'px';
                  }}
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className={cn(
                  'flex-shrink-0 h-8 w-8 flex items-center justify-center rounded border transition-colors',
                  loading || !input.trim()
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-white'
                    : 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700',
                )}
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <span className="text-[10px] text-slate-400 font-mono">Enter · Shift+Enter new line</span>
              <span className="text-[10px] text-slate-300">WAF scope</span>
            </div>
          </div>
        </div>
      )}

      <AiProviderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
