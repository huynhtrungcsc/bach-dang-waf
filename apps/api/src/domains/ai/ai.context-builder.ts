import os from 'os';
import logger from '../../utils/logger';
import { getParsedLogs } from '../logs/logs.service';
import { modSecService } from '../modsec/modsec.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { IntentType, SystemContextSection } from './ai.types';

const dashboardSvc = new DashboardService();

// ─── Intent detection ─────────────────────────────────────────────────────────

const INTENT_PATTERNS: Record<Exclude<IntentType, 'general'>, RegExp> = {
  metrics: /ram|cpu|memory|bộ nhớ|processor|tải|load|disk|ổ cứng|uptime|hệ thống|performance|hiệu suất|overload|quá tải|tài nguyên|resource|tài nguyên/i,
  rules: /rule|quy tắc|modsecurity|modsec|waf rule|bật|tắt|enable|disable|crs|owasp|kích hoạt|vô hiệu|paranoia|custom rule/i,
  logs: /log|nhật ký|attack|tấn công|sql|xss|injection|lfi|rfi|rce|dos|ddos|brute|cuộc tấn|sự kiện|event|bảo mật|security event|audit|malicious|độc hại/i,
  traffic: /traffic|lưu lượng|request|băng thông|bandwidth|kết nối|connection|truy cập|visitor|request.+phút|request.+giờ|rps|qps/i,
  domains: /domain|site|trang web|proxy|website|host|tên miền|ssl|certificate|chứng chỉ/i,
  alerts: /alert|cảnh báo|warning|thông báo|notification|incident/i,
};

export function detectIntents(message: string): IntentType[] {
  const found: IntentType[] = [];
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(message)) found.push(intent as IntentType);
  }
  return found.length > 0 ? found : ['general'];
}

// ─── Time window extraction ───────────────────────────────────────────────────

export function extractTimeWindowMinutes(message: string): number {
  const minMatch = message.match(/(\d+)\s*(phút|minute)/i);
  if (minMatch) return parseInt(minMatch[1]);
  const hrMatch = message.match(/(\d+)\s*(giờ|hour)/i);
  if (hrMatch) return parseInt(hrMatch[1]) * 60;
  if (/hôm nay|today/i.test(message)) return 1440;
  if (/hôm qua|yesterday/i.test(message)) return 2880;
  return 60; // default: last 1 hour
}

// ─── Token budget helper ──────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function truncate(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 3.5;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n...[đã rút gọn]';
}

// ─── Context sections ─────────────────────────────────────────────────────────

async function buildMetricsContext(): Promise<SystemContextSection> {
  try {
    const stats = await dashboardSvc.getDashboardStats();
    const mem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = mem - freeMem;
    const loadAvg = os.loadavg();

    const lines = [
      `CPU: ${stats.system.cpuUsage.toFixed(1)}% (${stats.system.cpuCores} cores, load 1m/5m/15m: ${loadAvg.map(l => l.toFixed(2)).join('/')})`,
      `RAM: ${(usedMem / 1024 ** 3).toFixed(2)} GB / ${(mem / 1024 ** 3).toFixed(2)} GB (${stats.system.memoryUsage.toFixed(1)}% used)`,
      `Disk: ${stats.system.diskUsage.toFixed(1)}% used`,
      `Uptime: ${stats.uptimeDuration} (${stats.uptime.toFixed(2)}% availability)`,
      `Domains: ${stats.domains.total} total, ${stats.domains.active} active`,
      `Alerts: ${stats.alerts.total} (critical: ${stats.alerts.critical}, warning: ${stats.alerts.warning})`,
    ];
    return { label: 'SYSTEM METRICS', data: lines.join('\n') };
  } catch (err) {
    logger.warn('[AI] metrics error:', err);
    return { label: 'SYSTEM METRICS', data: 'Không thể lấy thông tin hệ thống.' };
  }
}

async function buildRulesContext(): Promise<SystemContextSection> {
  try {
    const [crsRules, customRules] = await Promise.all([
      modSecService.listCrsRules(),
      modSecService.listCustomRules(),
    ]);

    const enabledCRS  = crsRules.filter(r => r.enabled);
    const disabledCRS = crsRules.filter(r => !r.enabled);

    const lines: string[] = [
      `OWASP CRS: ${enabledCRS.length} BẬT / ${disabledCRS.length} TẮT (tổng: ${crsRules.length})`,
    ];

    if (enabledCRS.length > 0) {
      lines.push('CRS đang BẬT:');
      enabledCRS.slice(0, 15).forEach(r =>
        lines.push(`  [ON] ${r.ruleFile} — ${r.name} (cat: ${r.category}, paranoia: ${r.paranoia})`)
      );
    }
    if (disabledCRS.length > 0) {
      lines.push('CRS đang TẮT:');
      disabledCRS.slice(0, 10).forEach(r =>
        lines.push(`  [OFF] ${r.ruleFile} — ${r.name}`)
      );
    }
    if (customRules.length > 0) {
      lines.push(`Custom Rules (${customRules.length} total):`);
      customRules.slice(0, 10).forEach((r: any) =>
        lines.push(`  [${r.enabled ? 'ON' : 'OFF'}] ${r.name || r.id}`)
      );
    }

    return { label: 'WAF RULES', data: truncate(lines.join('\n'), 700) };
  } catch (err) {
    logger.warn('[AI] rules error:', err);
    return { label: 'WAF RULES', data: 'Không thể lấy thông tin rules.' };
  }
}

async function buildLogsContext(message: string, windowMinutes: number): Promise<SystemContextSection> {
  try {
    const limit = windowMinutes <= 10 ? 50 : windowMinutes <= 60 ? 100 : 200;
    const allLogs = await getParsedLogs({ limit, type: 'all' });

    if (allLogs.length === 0) {
      return { label: 'LOGS', data: 'Không có log nào trong hệ thống.' };
    }

    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const windowLogs = allLogs.filter(l => new Date(l.timestamp) >= cutoff);
    const targetLogs = windowLogs.length > 0 ? windowLogs : allLogs.slice(0, 50);

    // Keyword-based secondary filter
    let filtered = targetLogs;
    if (/sql.?inject/i.test(message))  filtered = targetLogs.filter(l => /sql|injection|select|union|drop/i.test(l.message));
    else if (/xss|cross.site/i.test(message)) filtered = targetLogs.filter(l => /xss|script|alert\(/i.test(l.message));
    else if (/brute.?force/i.test(message))   filtered = targetLogs.filter(l => /brute|force|login|auth/i.test(l.message));
    else if (/dos|ddos/i.test(message))       filtered = targetLogs.filter(l => /dos|ddos|flood|rate/i.test(l.message));
    else if (/đầu tiên|first/i.test(message)) filtered = [...targetLogs].reverse().slice(0, 10);
    else if (/mới nhất|latest/i.test(message)) filtered = targetLogs.slice(0, 15);

    const displayLogs = filtered.length > 0 ? filtered : targetLogs.slice(0, 30);
    const attackLogs  = displayLogs.filter(l => l.level === 'error' || /block|deny|rule/i.test(l.message));
    const uniqueIPs   = new Set(displayLogs.map(l => l.ip).filter(Boolean));

    const header = [
      `Period: ${windowMinutes} phút | Events in window: ${targetLogs.length} | Attacks/blocks: ${attackLogs.length}`,
      `Unique IPs: ${uniqueIPs.size} (${Array.from(uniqueIPs).slice(0, 6).join(', ')}${uniqueIPs.size > 6 ? '...' : ''})`,
      '',
    ];
    const rows = displayLogs.slice(0, 35).map(l =>
      `[${new Date(l.timestamp).toLocaleString('vi-VN')}][${l.level.toUpperCase()}] IP:${l.ip || '-'} ${l.path ? 'PATH:' + l.path : ''} — ${l.message.slice(0, 180)}`
    );

    return { label: 'LOGS / ATTACKS', data: truncate([...header, ...rows].join('\n'), 900) };
  } catch (err) {
    logger.warn('[AI] logs error:', err);
    return { label: 'LOGS', data: 'Không thể đọc log hệ thống.' };
  }
}

async function buildTrafficContext(): Promise<SystemContextSection> {
  try {
    const stats = await dashboardSvc.getDashboardStats();
    const t = stats.traffic as any;
    const lines = [
      `Total requests: ${t?.totalRequests ?? 'N/A'}`,
      `Blocked: ${t?.blockedRequests ?? 'N/A'} (${t?.blockRate ? (t.blockRate * 100).toFixed(2) + '%' : 'N/A'} block rate)`,
      `Legitimate: ${t?.legitimateRequests ?? 'N/A'}`,
    ];
    return { label: 'TRAFFIC', data: lines.join('\n') };
  } catch (err) {
    logger.warn('[AI] traffic error:', err);
    return { label: 'TRAFFIC', data: 'Không thể lấy thống kê lưu lượng.' };
  }
}

async function buildDomainsContext(): Promise<SystemContextSection> {
  try {
    const stats = await dashboardSvc.getDashboardStats();
    const lines = [
      `Total domains: ${stats.domains.total}`,
      `Active: ${stats.domains.active}, Inactive: ${stats.domains.inactive ?? 0}`,
    ];
    return { label: 'DOMAINS', data: lines.join('\n') };
  } catch (err) {
    logger.warn('[AI] domains error:', err);
    return { label: 'DOMAINS', data: 'Không thể lấy thông tin domains.' };
  }
}

async function buildAlertsContext(): Promise<SystemContextSection> {
  try {
    const alerts = await dashboardSvc.getRecentAlerts(15);
    if (!alerts?.length) return { label: 'ALERTS', data: 'Không có cảnh báo gần đây.' };
    const rows = alerts.slice(0, 12).map((a: any) =>
      `[${(a.severity || 'INFO').toUpperCase()}] ${new Date(a.createdAt || Date.now()).toLocaleString('vi-VN')} — ${a.message || a.title || '-'}`
    );
    return { label: 'ALERTS', data: rows.join('\n') };
  } catch (err) {
    logger.warn('[AI] alerts error:', err);
    return { label: 'ALERTS', data: 'Không thể lấy cảnh báo.' };
  }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

const FETCHERS: Partial<Record<IntentType, (msg: string, win: number) => Promise<SystemContextSection>>> = {
  metrics: () => buildMetricsContext(),
  rules:   () => buildRulesContext(),
  logs:    (m, w) => buildLogsContext(m, w),
  traffic: () => buildTrafficContext(),
  domains: () => buildDomainsContext(),
  alerts:  () => buildAlertsContext(),
};

export async function buildContext(message: string, intents: IntentType[]): Promise<string> {
  const TOKEN_BUDGET = 2800;
  const windowMinutes = extractTimeWindowMinutes(message);

  const toFetch: IntentType[] = intents.includes('general')
    ? ['metrics', 'rules', 'alerts']
    : intents.filter(i => i !== 'general');

  const sections = await Promise.all(
    toFetch.map(intent => FETCHERS[intent]?.(message, windowMinutes) ?? Promise.resolve(null))
  );

  const parts: string[] = [];
  let usedTokens = 0;

  for (const section of sections) {
    if (!section) continue;
    const text = `### ${section.label}\n${section.data}`;
    const cost = estimateTokens(text);
    if (usedTokens + cost > TOKEN_BUDGET) {
      parts.push(`### ${section.label}\n[Dữ liệu bị rút gọn]`);
    } else {
      parts.push(text);
      usedTokens += cost;
    }
  }

  if (parts.length === 0) return '';
  return `=== DỮ LIỆU HỆ THỐNG (real-time) ===\n${parts.join('\n\n')}\n=== KẾT THÚC ===`;
}
