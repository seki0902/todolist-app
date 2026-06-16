import type { ParseResult, AIMeta } from '../../shared/types/ai';
import { Priority } from '../../shared/types/database';

// ─── Regex patterns ───────────────────────────────────────────

const PATTERNS = {
  // "明天/后天 早上/下午/晚上? 动作"
  relativeDay: /(明天|后天)(早上|上午|下午|晚上|中午)?(.+)/,
  // "每天 早上/下午/晚上? 动作" or "每天早上8点动作"
  daily: /每天(早上|上午|下午|晚上)?(\d{1,2})?点?(.+)/,
  // "每周X 早上/下午/晚上? 时间? 动作"
  weekly: /每周([一二三四五六日天])(早上|上午|下午|晚上)?(\d{1,2})?点?(.+)/,
  // "每月X号/日 动作"
  monthly: /每月(\d{1,2})[号日](.+)/,
  // "X分钟" → pomodoro
  minutes: /(\d+)\s*分钟/,
  // "提前X分钟提醒" or "X分钟前提醒"
  reminder: /提前\s*(\d+)\s*分钟\s*提醒|(\d+)\s*分钟\s*前\s*提醒/,
  // Priority keywords
  urgent: /(紧急|马上|立刻|立即|deadline)/i,
  important: /(重要|优先)/,
  // Clean-up leading markers and brackets
  cleanMarker: /^[：:]\s*/,
};

const WEEKDAY_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0,
};

const TIME_PERIOD_HOURS: Record<string, number> = {
  '早上': 8, '上午': 9, '中午': 12, '下午': 14, '晚上': 19,
};

// ─── Helpers ──────────────────────────────────────────────────

function getPriority(text: string): Priority {
  if (PATTERNS.urgent.test(text)) return Priority.P1;
  if (PATTERNS.important.test(text)) return Priority.P2;
  return Priority.P3;
}

function buildHint(result: Partial<ParseResult>): string {
  const hints: string[] = [];
  if (result.recurrence_type === 'daily') hints.push('重复：每天');
  if (result.recurrence_type === 'weekly') hints.push('重复：每周');
  if (result.recurrence_type === 'monthly') hints.push('重复：每月');
  if (result.due_time) {
    const d = new Date(result.due_time);
    hints.push(`截止：${d.getMonth() + 1}月${d.getDate()}日`);
  }
  if (result.estimated_pomodoro) hints.push(`番茄钟：${result.estimated_pomodoro}个`);
  if (result.reminder_offset) hints.push(`提醒：提前${result.reminder_offset}分钟`);
  if (hints.length === 0) hints.push('标题已自动填写');
  return hints.map((h) => `已自动填写「${h}」`).join('，');
}

function cleanTitle(raw: string): string {
  return raw
    .replace(PATTERNS.cleanMarker, '')
    .replace(/^(紧急|重要|优先)[：:]\s*/, '')
    .trim();
}

function parseDueTime(
  dateStr: string | undefined,
  timeStr: string | undefined,
  hourStr: string | undefined,
): number | undefined {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Handle relative day
  if (dateStr === '明天') target.setDate(target.getDate() + 1);
  else if (dateStr === '后天') target.setDate(target.getDate() + 2);

  // Determine hour
  let hour: number | undefined;
  if (hourStr) {
    hour = parseInt(hourStr, 10);
    // Apply time period offset: 下午/晚上 → +12
    if (timeStr === '下午' && hour < 12) hour += 12;
    else if (timeStr === '晚上' && hour < 12) hour += 12;
  } else if (timeStr && TIME_PERIOD_HOURS[timeStr] !== undefined) {
    hour = TIME_PERIOD_HOURS[timeStr];
  }

  if (hour !== undefined) {
    target.setHours(hour, 0, 0, 0);
  } else if (dateStr) {
    target.setHours(23, 59, 0, 0);
  } else {
    return undefined;
  }

  return target.getTime();
}

// ─── Main parser ──────────────────────────────────────────────

export interface ParseOptions {
  ollamaAvailable?: boolean;
}

export function parseTasks(text: string, _options?: ParseOptions): ParseResult[] {
  // Split by common separators
  const segments = text
    .split(/[,，;；\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const results: ParseResult[] = [];

  for (const segment of segments) {
    const result = parseSingle(segment);
    if (result && result.confidence >= 0.3) {
      results.push(result);
    }
  }

  return results;
}

function parseSingle(text: string): ParseResult | null {
  if (!text || text.trim().length === 0) return null;

  let match: RegExpMatchArray | null;
  let title = '';
  let recurrenceType: string | undefined;
  let recurrenceDays: number[] | undefined;
  let dueTime: number | undefined;
  let estimatedPomodoro: number | undefined;
  let reminderOffset: number | undefined;
  let confidence = 0.3;

  // ── Weekly ──
  match = text.match(PATTERNS.weekly);
  if (match) {
    const [, weekday, timePeriod, hourStr, action] = match;
    const dayNum = WEEKDAY_MAP[weekday];
    recurrenceType = 'weekly';
    recurrenceDays = dayNum !== undefined ? [dayNum] : undefined;
    title = cleanTitle(action);
    dueTime = parseDueTime(undefined, timePeriod, hourStr);
    confidence = dueTime ? 0.95 : 0.8;
  }
  // ── Daily ──
  else if ((match = text.match(PATTERNS.daily))) {
    const [, timePeriod, hourStr, action] = match;
    recurrenceType = 'daily';
    title = cleanTitle(action);
    dueTime = parseDueTime(undefined, timePeriod, hourStr);
    confidence = dueTime ? 0.9 : 0.8;
  }
  // ── Monthly ──
  else if ((match = text.match(PATTERNS.monthly))) {
    const [, dayNum, action] = match;
    recurrenceType = 'monthly';
    title = cleanTitle(action);
    // monthly due day: schedule for this month's dayNum
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), parseInt(dayNum, 10));
    target.setHours(9, 0, 0, 0);
    if (target.getTime() < Date.now()) {
      target.setMonth(target.getMonth() + 1);
    }
    dueTime = target.getTime();
    confidence = 0.85;
  }
  // ── Relative day (tomorrow / day after tomorrow) ──
  else if ((match = text.match(PATTERNS.relativeDay))) {
    const [, dayWord, timePeriod, action] = match;
    title = cleanTitle(action);
    dueTime = parseDueTime(dayWord, timePeriod, undefined);
    confidence = 0.7;
  }
  // ── Fallback: plain text, use as title ──
  else {
    title = cleanTitle(text);
    confidence = 0.3;
  }

  // ── Extract pomodoro hint ──
  const pomMatch = text.match(PATTERNS.minutes);
  if (pomMatch) {
    const mins = parseInt(pomMatch[1], 10);
    estimatedPomodoro = Math.max(1, Math.ceil(mins / 25));
    if (confidence < 0.5) confidence = 0.5;
  }

  // ── Extract reminder offset ──
  const remMatch = text.match(PATTERNS.reminder);
  if (remMatch) {
    const mins = parseInt(remMatch[1] || remMatch[2], 10);
    if (mins > 0) reminderOffset = mins;
  }

  // ── Default due_time for recurring tasks without explicit time ──
  if (!dueTime && recurrenceType) {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // default 9:00 AM
    if (recurrenceType === 'daily') {
      // Today at 9am, or tomorrow if already past 9am today
      if (now.getTime() < Date.now()) now.setDate(now.getDate() + 1);
      dueTime = now.getTime();
    } else if (recurrenceType === 'weekly' && recurrenceDays && recurrenceDays.length > 0) {
      // Next occurrence of the first specified weekday
      const targetDay = recurrenceDays[0];
      const today = new Date();
      // If today matches the target day and it's still before 9am, use today
      if (today.getDay() === targetDay && today.getHours() < 9) {
        dueTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0).getTime();
      } else {
        // Find next matching day
        const next = new Date(today);
        next.setHours(9, 0, 0, 0);
        let added = 0;
        while (next.getDay() !== targetDay || added === 0) {
          next.setDate(next.getDate() + 1);
          added++;
          if (added > 7) break;
        }
        dueTime = next.getTime();
      }
    } else if (recurrenceType === 'monthly') {
      // Next month on the specified day (1st) at 9am
      const target = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0);
      if (target.getTime() < Date.now()) target.setMonth(target.getMonth() + 1);
      dueTime = target.getTime();
    }
  }

  // ── Strip minute count from title ──
  title = title.replace(/\d+\s*分钟\s*/g, '').trim();
  if (!title) title = cleanTitle(text).replace(/\d+\s*分钟\s*/g, '').trim();
  if (!title) title = text.trim();

  // ── Priority ──
  const priority = getPriority(text);

  // ── Build hint ──
  const partial: Partial<ParseResult> = {
    recurrence_type: recurrenceType,
    recurrence_days: recurrenceDays,
    due_time: dueTime,
    estimated_pomodoro: estimatedPomodoro,
    reminder_offset: reminderOffset,
  };
  const aiHint = buildHint(partial);

  return {
    title: title || text,
    priority,
    due_time: dueTime,
    recurrence_type: recurrenceType,
    recurrence_days: recurrenceDays,
    estimated_pomodoro: estimatedPomodoro,
    reminder_offset: reminderOffset,
    confidence,
    ai_hint: aiHint,
    source: 'regex' as const,
  };
}

/** Build AIMeta JSON to store on created task */
export function buildAIMeta(
  source: AIMeta['source'],
  confidence: number,
  rawInput: string,
): string {
  const meta: AIMeta = {
    source,
    confidence,
    raw_input: rawInput,
    parsed_at: Date.now(),
  };
  return JSON.stringify(meta);
}

// ─── Ollama Integration ───────────────────────────────────────

const OLLAMA_BASE = 'http://localhost:11434';
const SYSTEM_PROMPT = `你是任务解析助手。把用户的自然语言输入拆成任务列表。

返回纯 JSON 数组，每个元素包含:
{
  "title": "任务标题",
  "description": "补充描述（可选）",
  "priority": 1|2|3|4,
  "due_time": "YYYY-MM-DD HH:mm" | null,
  "recurrence_type": "daily"|"weekly"|"monthly"|null,
  "recurrence_days": [1,3,5] | null,
  "estimated_pomodoro": number | null,
  "reminder_offset": number | null,
  "confidence": 0-1 小数
}

规则:
- 标题简洁准确，去除"我要""需要"等冗余词
- 优先级: 1=紧急 2=重要 3=一般 4=不急。出现"紧急""马上""deadline"=1
- 重复: "每天"→daily, "每周X"→weekly, "每月X号"→monthly
- recurrence_days: 周一=1 ... 周日=0
- 番茄钟: 提到"X分钟"的任务，estimated_pomodoro = ceil(X/25)
- 提醒: 提到"提前X分钟提醒"，reminder_offset = X
- 没有明确信息时用 null，不要编造
- 只返回 JSON，不要任何解释文字`;

let ollamaChecked = false;
let ollamaAvailable = false;
let firstCall = true;

/** Check if Ollama is running on localhost:11434 */
export async function checkOllama(): Promise<boolean> {
  if (ollamaChecked) return ollamaAvailable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    ollamaAvailable = res.ok;
  } catch {
    ollamaAvailable = false;
  }
  ollamaChecked = true;
  return ollamaAvailable;
}

/** Force re-check Ollama availability (e.g. after user installs it) */
export function resetOllamaCheck(): void {
  ollamaChecked = false;
  ollamaAvailable = false;
  firstCall = true;
}

/** Call Ollama to enhance parse results */
export async function parseWithOllama(text: string): Promise<ParseResult[]> {
  const isFirst = firstCall;
  firstCall = false;
  const timeoutMs = isFirst ? 30000 : 10000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:1.5b',
        prompt: `${SYSTEM_PROMPT}\n\n用户输入: ${text}`,
        stream: false,
        options: { num_predict: 512 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = (await res.json()) as { response?: string };
    if (!data.response) return [];

    // Extract JSON from response (may contain extra text)
    const jsonMatch = data.response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
    const results: ParseResult[] = parsed.map((item) => ({
      title: String(item.title || ''),
      description: item.description ? String(item.description) : undefined,
      priority: typeof item.priority === 'number' ? (item.priority as Priority) : Priority.P3,
      due_time: item.due_time ? new Date(String(item.due_time)).getTime() : undefined,
      recurrence_type: item.recurrence_type ? String(item.recurrence_type) : undefined,
      recurrence_days: Array.isArray(item.recurrence_days)
        ? item.recurrence_days.map(Number)
        : undefined,
      estimated_pomodoro: typeof item.estimated_pomodoro === 'number'
        ? item.estimated_pomodoro
        : undefined,
      reminder_offset: typeof item.reminder_offset === 'number'
        ? item.reminder_offset
        : undefined,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      ai_hint: '已由 AI 自动填写',
      source: 'ollama' as const,
    }));

    return results;
  } catch {
    // Timeout or network error — fall back to regex results
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Full pipeline: Ollama first (if available), regex as fallback */
export async function parseWithAI(text: string): Promise<ParseResult[]> {
  // Always try Ollama first
  const available = await checkOllama();
  if (available) {
    const ollamaResults = await parseWithOllama(text);
    if (ollamaResults.length > 0) {
      console.log('[AI-PARSER] Using Ollama results:', ollamaResults.length, 'items');
      return ollamaResults;
    }
    console.log('[AI-PARSER] Ollama returned empty, falling back to regex');
  }

  // Fallback to regex
  return parseTasks(text);
}
