import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BotMessageSquare, X, Send, Loader2,
  ChevronDown, Shield, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiService, ChatMessage } from '@/services/ai.service';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message extends ChatMessage {
  id: string;
  ts: Date;
  model?: string;
  isError?: boolean;
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'RAM và CPU hiện tại bao nhiêu?',
  'Hệ thống đang bật những rule WAF nào?',
  'Các cuộc tấn công trong 1 giờ gần đây?',
  'Rule nào đang tắt trong hệ thống?',
  'Cuộc tấn công SQL Injection mới nhất là gì?',
  'Có bao nhiêu domain đang được bảo vệ?',
  'Hệ thống có đang bị quá tải không?',
  'Giải thích các cảnh báo gần đây',
];

// ─── Loading dots ─────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[88%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-3 py-2.5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : msg.isError
                ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-sm'
          )}
        >
          {msg.content}
        </div>
        <div className={cn('flex items-center gap-1.5 px-0.5', isUser ? 'justify-end' : 'justify-start')}>
          <span className="text-[11px] text-slate-400">
            {msg.ts.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.model && msg.model !== 'guard' && (
            <span className="text-[10px] text-slate-300 font-mono">
              {msg.model.split('/').pop()}
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, scrollToBottom]);

  const buildHistory = (): ChatMessage[] =>
    messages
      .filter(m => !m.isError)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

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
      const history = buildHistory();
      const res = await aiService.chat(trimmed, history);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        ts: new Date(),
        model: res.model,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errText =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể kết nối dịch vụ AI. Vui lòng thử lại.';
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errText,
        ts: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
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
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center justify-center',
          'w-12 h-12 rounded-full shadow-lg transition-all duration-200',
          'bg-blue-600 text-white hover:bg-blue-700 active:scale-95',
          open && 'rotate-180 bg-slate-700 hover:bg-slate-800'
        )}
        title="WAF Assistant"
      >
        {open ? <X className="w-5 h-5" /> : <BotMessageSquare className="w-5 h-5" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed bottom-0 right-0 z-40 flex flex-col',
          'w-[400px] h-[600px] max-h-[90vh]',
          'bg-slate-50 border-l border-t border-slate-200 shadow-xl',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0 translate-y-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded bg-blue-600">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 leading-none">WAF Assistant</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Bach Dang WAF AI</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Xóa lịch sử"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Welcome / suggestions */}
          {messages.length === 0 && showSuggestions && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Xin chào! Tôi là WAF Assistant. Tôi có thể giúp bạn phân tích:
                </p>
                <ul className="mt-2 text-xs text-slate-500 space-y-1 list-disc list-inside">
                  <li>Tài nguyên hệ thống (CPU, RAM, disk)</li>
                  <li>WAF rules — bật/tắt, giải thích</li>
                  <li>Logs và phân tích tấn công</li>
                  <li>Lưu lượng và cảnh báo bảo mật</li>
                </ul>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs px-3 py-2 rounded border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-lg rounded-bl-sm shadow-xs">
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về hệ thống WAF..."
              disabled={loading}
              rows={1}
              className={cn(
                'flex-1 resize-none rounded-md border border-slate-200 bg-slate-50',
                'px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:opacity-50 max-h-28 overflow-y-auto',
                'scrollbar-thin'
              )}
              style={{ lineHeight: '1.5' }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 112) + 'px';
              }}
            />
            <Button
              size="icon-sm"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            Enter gửi · Shift+Enter xuống dòng · Chỉ hỗ trợ câu hỏi về WAF
          </p>
        </div>
      </div>
    </>
  );
}
