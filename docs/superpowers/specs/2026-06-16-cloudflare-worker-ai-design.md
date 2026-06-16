# FocusFlow — DeepSeek AI 云端解析方案

> 日期: 2026-06-16
> 状态: 待实施
> 核心目标: 用户零配置使用真正的大模型做任务智能拆分

---

## 架构

```
FocusFlow 客户端（Electron）
    │  POST https://<你的域名>/parse
    │  Body: { text: "我每周一开会" }
    ▼
Cloudflare Worker（免费，10万次/天）
    │  环境变量 DEEPSEEK_API_KEY（只有你能看到）
    │  拼接 system prompt + 用户输入
    │  POST https://api.deepseek.com/v1/chat/completions
    ▼
DeepSeek V4 Flash API
    │ 花费: ~0.01 美分/次
    ▼
返回 JSON → Worker 透传给客户端 → 任务确认界面
```

## 成本

| 层级 | 费用 |
|------|------|
| Cloudflare Worker | 免费（每天 10 万请求，远超实际用量） |
| DeepSeek API | 1000 用户 × 10 次/天 × 30 天 ≈ 每月 ¥20 |
| 用户端 | 零配置、零费用、无需 API Key |

## 改什么

### 新增 2 个文件

| 文件 | 内容 |
|------|------|
| `worker/worker.js` | Cloudflare Worker 代码（~30行），部署到 Cloudflare |
| `worker/wrangler.toml` | Cloudflare 部署配置，`DEEPSEEK_API_KEY` 环境变量 |

### 修改 4 个文件（客户端）

| 文件 | 改动 |
|------|------|
| `src/electron-main/services/ai-parser.service.ts` | 新增 `parseWithDeepSeek()` 函数，调 Worker URL；`parseWithAI` 优先走 DeepSeek，失败回退正则 |
| `src/electron-main/ipc/ai.ipc.ts` | 无需改动（IPC 层不变，parser 内部切换） |
| `src/components/tasks/SmartInput.tsx` | 在输入框下方加一行轻提示："由 DeepSeek AI 驱动 · 免费解析" |
| `.gitignore` | 加入 `worker/.dev.vars`（本地调试用的 Key） |

### 客户端无需改动的部分

- IPC 通道、Preload、Main registration、TaskForm、TaskList 队列、确认流程——全部不变
- 正则引擎保留作为离线回退

## Cloudflare Worker 代码

```javascript
// worker/worker.js — 部署到 Cloudflare Workers

export default {
  async fetch(request, env) {
    // 只接受 POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { text } = await request.json();
    if (!text) {
      return Response.json({ error: '请输入任务描述' }, { status: 400 });
    }

    // 调用 DeepSeek
    const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // → V4 Flash
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    const data = await dsRes.json();
    const content = data.choices?.[0]?.message?.content;

    // 解析 DeepSeek 返回的 JSON
    try {
      const json = JSON.parse(content.match(/\[[\s\S]*\]/)?.[0] || '[]');
      return Response.json(json);
    } catch {
      return Response.json([]);
    }
  },
};

const SYSTEM_PROMPT = `你是任务解析助手。把用户输入拆成任务列表。

返回纯 JSON 数组：
[{
  "title": "任务名称",
  "description": "补充描述",
  "priority": 1|2|3|4,
  "due_time": "YYYY-MM-DD HH:mm" 或 null,
  "recurrence_type": "daily"|"weekly"|"monthly" 或 null,
  "recurrence_days": [1,3,5] 或 null,
  "estimated_pomodoro": 数字 或 null,
  "reminder_offset": 数字 或 null,
  "confidence": 0-1,
  "ai_hint": "已自动填写「xxx」"
}]

规则:
- 优先级: 1=紧急 2=重要 3=一般 4=不急
- 重复: "每天"→daily, "每周X"→weekly(X=一→1...日→0), "每月X号"→monthly
- "X分钟"→estimated_pomodoro=ceil(X/25)
- "提前X分钟提醒"→reminder_offset=X
- ai_hint: 用中文告诉用户你自动填了什么
- 只返回 JSON，不要其他文字`;
```

## 部署步骤（你来操作，不需要给我 Key）

### 1. 安装 Wrangler
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```

### 3. 设置 Key（只存在于你的 Cloudflare 后台）
```bash
wrangler secret put DEEPSEEK_API_KEY
# 粘贴你的 DeepSeek API Key
```

### 4. 部署
```bash
cd worker
wrangler deploy
```
部署成功后终端会显示 Worker URL，类似 `https://ai-parse.<你的子域名>.workers.dev`。

### 5. 告诉我 Worker URL
把这个 URL 告诉我，我写进 FocusFlow 代码里。**你的 Key 我永远看不到。**

## 客户端改动的关键技术细节

### `parseWithDeepSeek()` 函数（ai-parser.service.ts 新增）

```typescript
const WORKER_URL = 'https://<你填的地址>/parse';

async function parseWithDeepSeek(text: string): Promise<ParseResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const items = await res.json();
    // 转换为 ParseResult[] 格式
    return items.map((item: Record<string, unknown>) => ({
      title: String(item.title || ''),
      description: item.description ? String(item.description) : undefined,
      priority: typeof item.priority === 'number' ? item.priority as Priority : Priority.P3,
      due_time: item.due_time ? new Date(String(item.due_time)).getTime() : undefined,
      recurrence_type: item.recurrence_type ? String(item.recurrence_type) : undefined,
      recurrence_days: Array.isArray(item.recurrence_days) ? item.recurrence_days.map(Number) : undefined,
      estimated_pomodoro: typeof item.estimated_pomodoro === 'number' ? item.estimated_pomodoro : undefined,
      reminder_offset: typeof item.reminder_offset === 'number' ? item.reminder_offset : undefined,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      ai_hint: item.ai_hint ? String(item.ai_hint) : '已由 AI 自动填写',
      source: 'ollama' as const, // 复用 source 字段，表示云端 AI
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
```

### `parseWithAI` 更新（覆盖 Ollama 路径）

```typescript
// 之前的 parseWithAI 尝试 Ollama → 改为尝试 DeepSeek Worker
export async function parseWithAI(text: string): Promise<ParseResult[]> {
  // 1. 先试 DeepSeek Worker
  const dsResults = await parseWithDeepSeek(text);
  if (dsResults.length > 0) return dsResults;

  // 2. 回退到正则引擎（离线可用）
  return parseTasks(text);
}
```

### SmartInput 轻提示

```tsx
<p className="mt-1 text-[10px] text-muted-foreground">
  由 DeepSeek AI 驱动 · 免费使用
</p>
```

## 为什么你的 Key 是安全的

1. Key 只在 Cloudflare Workers 后台的 `env.DEEPSEEK_API_KEY` 里，你通过 `wrangler secret put` 注入
2. Worker 代码里没有硬编码 Key
3. 客户端（Electron 包）里不包含 Key
4. 即使有人反编译 Electron 包，也只能看到 Worker URL，拿不到 Key
5. DeepSeek 后台可以设消费上限，即使 Worker 被攻击也有天花板

## 回退机制

如果 Worker 挂了 / 超时 / 超过免费额度 → 自动回退到本地正则引擎。用户不会感知到任何故障。

## 实施顺序

1. 你部署 Worker → 拿到 URL
2. 我改客户端代码（新增 parseWithDeepSeek、更新 parseWithAI、SmartInput 提示）
3. Build + 重启 → 测试
