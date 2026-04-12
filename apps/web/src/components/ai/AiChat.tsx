import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal, X, Send, Loader2, ChevronRight,
  RotateCcw, Settings2, AlertCircle,
} from 'lucide-react';
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

// ─── Suggested queries ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'System metrics', query: 'RAM và CPU hiện tại bao nhiêu?' },
  { label: 'Active WAF rules', query: 'Hệ thống đang bật những rule WAF nào?' },
  { label: 'Attack events (1h)', query: 'Các cuộc tấn công trong 1 giờ gần đây?' },
  { label: 'Disabled rules', query: 'Rule nào đang tắt trong hệ thống?' },
  { label: 'SQL injection log', query: 'Cuộc tấn công SQL Injection mới nhất là gì?' },
  { label: 'Protected sites', query: 'Có bao nhiêu domain đang được bảo vệ?' },
];

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-0.5 py-1 px-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="inline-block w-1 h-1 bg-slate-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.14}s` }}
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
      <div className="w-5 h-5 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center mt-0.5">
        <Terminal className="w-2.5 h-2.5 text-slate-200" />
      </div>
      <div className="max-w-[88%] min-w-0">
        <div className={cn(
          'text-[13px] rounded px-3 py-2 leading-relaxed whitespace-pre-wrap break-words border',
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
          {msg.content}
        </div>
        <div className="flex items-center gap-2 mt-0.5 pl-0.5">
          <span className="text-[10px] text-slate-400">{time}</span>
          {msg.model && msg.model !== 'guard' && (
            <span className="text-[10px] text-slate-300 font-mono truncate max-w-[200px]">
              {msg.model}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, messages, scrollToBottom]);

  const buildHistory = (): ChatMessage[] =>
    messages.filter(m => !m.isError).slice(-10).map(({ role, content }) => ({ role, content }));

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setShowSuggestions(false);
    setInput('');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      ts: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await aiService.chat(trimmed, buildHistory());
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        ts: new Date(),
        model: res.model,
      }]);
    } catch (err: any) {
      const errText =
        err?.response?.data?.message ||
        err?.message ||
        'Connection failed. Check AI provider configuration.';
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errText,
        ts: new Date(),
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setShowSuggestions(true);
    setInput('');
  };

  return (
    <>
      {/* ── Trigger chip ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center gap-2',
          'h-8 px-3 rounded border text-[12px] font-medium',
          'shadow-sm transition-all duration-150 select-none',
          open
            ? 'bg-slate-800 border-slate-700 text-white'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400',
        )}
        title="WAF Query Console"
      >
        {open ? (
          <><X className="w-3.5 h-3.5" /> Close</>
        ) : (
          <><Terminal className="w-3.5 h-3.5 text-slate-500" /> Query Console</>
        )}
      </button>

      {/* ── Panel ── */}
      <div
        className={cn(
          'fixed bottom-0 right-0 z-40 flex flex-col',
          'w-[420px] h-[580px] max-h-[90vh]',
          'bg-white border-l border-t border-slate-200',
          'shadow-2xl shadow-slate-900/10',
          'transition-transform duration-250 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-500" />
            <span className="text-[13px] font-semibold text-slate-700 tracking-tight">WAF Query Console</span>
            <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 ml-0.5">AI</span>
          </div>
          <div className="flex items-center gap-0.5">
            {isAdmin && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                title="AI Provider Settings"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                title="Clear session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
          {/* Welcome / suggestions */}
          {messages.length === 0 && showSuggestions && (
            <div className="space-y-3 pt-1">
              <div className="text-[12px] text-slate-500 border border-slate-200 rounded bg-white px-3 py-2.5 leading-relaxed">
                Query WAF system status, security rules, logs, and attack analytics.
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

          {messages.map(msg => (
            <MessageRow key={msg.id} msg={msg} />
          ))}

          {loading && (
            <div className="flex gap-2 items-start">
              <div className="w-5 h-5 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center mt-0.5">
                <Terminal className="w-2.5 h-2.5 text-slate-200" />
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
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter query..."
                disabled={loading}
                rows={1}
                className={cn(
                  'w-full resize-none rounded border border-slate-200 bg-slate-50',
                  'px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400',
                  'focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400',
                  'disabled:opacity-50 max-h-28 overflow-y-auto font-mono',
                )}
                style={{ lineHeight: '1.5' }}
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
                  : 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
              )}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <span className="text-[10px] text-slate-400 font-mono">Enter to send · Shift+Enter new line</span>
            <span className="text-[10px] text-slate-300">WAF scope only</span>
          </div>
        </div>
      </div>

      {/* Provider settings */}
      <AiProviderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
