# AI 智能任务拆分 — 设计文档

> 日期: 2026-06-11（修订: 2026-06-16）
> 状态: 已确认，已修订
> 应用: FocusFlow Desktop

## 1. 概述

在 FocusFlow 任务列表顶部新增一条「智能输入栏」，用户用自然语言描述要做的事（如 "每天健身30分钟，每周一下午3点开会，每月1号交房租"），系统自动解析成多个任务，逐个弹出编辑框让用户确认后批量创建。

**核心原则**: 不强制 AI，不要求用户配置 API Key，零额外成本。

## 2. 用户交互流程

```
用户输入自然语言 → 点击「智能解析」
  → 规则引擎 / Ollama 解析 → 返回 N 个 ParseResult
  → 逐个弹出 TaskForm 编辑框（预填 AI 识别字段）
  → 用户: 修改 → 保存 → 下一个
  → 全部确认或跳过 → 任务创建完成
```

### 2.1 智能输入栏

- **位置**: TaskList 顶部，位于标题行和 DayStrip 之间（与内联 WeekStrip 相邻但不重叠——WeekStrip 仅在 📅 点击后展开）
- **外观**: 紫色虚线边框的输入栏，左侧 🤖 图标，右侧「智能解析」按钮
- **提示词**: placeholder "用自然语言描述你要做的事，AI 自动拆分..."
- **快捷示例**: 输入栏下方显示可点击的示例（"试试: 每天健身30分钟"）
- **保留手动模式**: 「+ 新建任务」按钮完全不动，喜欢手动的用户不受影响

### 2.2 逐个确认编辑框

- **复用现有 TaskForm**: 不做新对话框，直接打开已有的编辑任务表单
- **进度提示**: 左上角显示 "AI 解析 · 第 1/3 个"
- **AI 识别提示**: 表单顶部绿色提示条，说明 AI 识别到了什么（如 "已自动填写「重复: 每天」"）
- **所有字段可编辑**: 标题、描述、优先级、状态、分类、截止日期、重复、提醒、番茄钟
- **操作按钮**:
  - 「跳过」— 跳过当前这个，进入下一个
  - 「全部跳过」— 放弃剩余所有解析结果，关闭表单
  - 「保存 → 下一个」— 创建当前任务，弹出下一个编辑框
- **关闭表单（点 X / 按 Escape）**: 视为「跳过当前这个」，进入下一个。如果只剩最后一个未处理，等同「取消全部」——剩余结果丢弃。
- **空输入保护**: 输入为空或纯空白时点击解析 → 输入栏变红抖动 + 提示 "请输入任务描述"
- **解析无结果**: 规则引擎返回 0 条 → 输入栏下方显示 "未识别到任务，请尝试更具体的描述，如'明天上午开会'"

## 3. 技术架构

### 3.1 新增文件

```
src/
├── components/tasks/SmartInput.tsx        # 智能输入栏 UI 组件
├── shared/types/ai.ts                     # ParseResult 类型定义
├── electron-main/
│   ├── ipc/ai.ipc.ts                      # ai:parse IPC handler
│   └── services/ai-parser.service.ts      # 规则引擎 + Ollama 调用
```

### 3.2 数据流

```
SmartInput (renderer)
    │  IPC: 'ai:parse' { text: string }
    ▼
ai-parser.service (main process)
    │
    ├── ① RegexParser.parse(text) → ParseResult[]
    │      - 匹配时间表达
    │      - 匹配重复规则
    │      - 提取标题
    │      - 推断优先级
    │
    ├── ② 如果规则置信度 < 阈值:
    │      - 检测 localhost:11434 (Ollama)
    │      - 可用 → OllamaParser.parse(text) → 补充/覆盖结果
    │      - 不可用 → 跳过，返回规则结果
    │
    ▼
返回 ParseResult[] 到 renderer
    │
    ▼
Render 端循环:
  for each ParseResult:
    打开 TaskForm (预填字段)
    等待用户保存/跳过
```

### 3.3 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/tasks/TaskList.tsx` | 引入 SmartInput 组件，放在标题行下方、DayStrip 上方 |
| `src/electron-main/main/main.ts` | 注册 ai:parse IPC handler |
| `src/shared/types/ipc.ts` | 新增 `AI: { PARSE: 'ai:parse' }` channel |
| `src/electron-main/preload/preload.ts` | 新增 `ai` 属性到 `FocusFlowAPI`，暴露 `window.api.ai.parse(text)` |

### 3.4 TaskList 内组件排列顺序（重要）

```
Header（标题 + 📅 日历图标 + 新建按钮）
SmartInput（常驻，紫色虚线框）
WeekStrip（点击 📅 后才内联展开，不展开时不存在）
DayStrip（今日进度条）
Toolbar（搜索 + 标签筛选 + 归档开关）
Task list content
```

SmartInput 和 WeekStrip 互不重叠——SmartInput 始终在标题下方常驻，WeekStrip 在 SmartInput 下方按需展开。

## 4. 规则引擎设计

### 4.1 支持的模式

| 模式 | 正则 | 示例输入 | 输出 |
|------|------|---------|------|
| 每天 + 动作 | `每天(早上\|下午\|晚上)?(.+)` | "每天健身" | title=健身, recurrence_type=daily |
| 每周X + 时间 + 动作 | `每周([一二三四五六日天])(早上\|下午\|晚上)?(\d{1,2})?点?(.+)` | "每周一下午3点开会" | title=开会, recurrence_type=weekly, recurrence_days=[1], due_time=15:00 |
| 每月X号 + 动作 | `每月(\d{1,2})[号日](.+)` | "每月1号交房租" | title=交房租, recurrence_type=monthly, dueDate=1 |
| 明天/后天 + 动作 | `(明天\|后天)(早上\|下午\|晚上)?(.+)` | "明天下午去超市" | title=去超市, due=明天/后天 |
| 优先级关键词 | `(紧急\|重要\|优先)` | "紧急：修复bug" | priority=P1 |
| 番茄钟提示 | `(\d+)分钟` | "学英语30分钟" | estimated_pomodoro 相关 |
| 提前提醒 | `提前(\d+)分钟提醒\|(\d+)分钟前提醒` | "下午3点开会，提前15分钟提醒" | reminder_offset=15（分钟） |

### 4.2 组合解析

单句中出现多个动作时（"每天A，每周B，每月C"），按逗号/分号/换行分割后分别解析。

### 4.3 置信度

规则引擎对每个解析结果输出置信度 (0-1):
- 只有标题、无时间/重复信息 → confidence: 0.3
- 有明确的重复规则 → confidence: 0.8
- 有时间 + 重复完整匹配 → confidence: 1.0

confidence < 0.5 的结果，在 Ollama 可用时发送给 AI 补充解析。

## 5. Ollama 集成（可选）

### 5.1 检测

```
GET http://localhost:11434/api/tags
```
- 返回 200 → Ollama 可用
- 连接失败/超时 → 不可用，静默跳过

### 5.2 调用

```
POST http://localhost:11434/api/generate
{
  "model": "qwen2.5:1.5b",
  "prompt": "<详细 system prompt>",
  "stream": false,
  "options": { "num_predict": 512 }
}
```
- **首次调用超时**: 30 秒（冷启动加载模型）
- **后续调用超时**: 10 秒（模型已在内存）
- 超时 → 回退到规则引擎结果

### 5.3 System Prompt（完整版）

```
你是任务解析助手。把用户的自然语言输入拆成任务列表。

返回纯 JSON 数组，每个元素包含:
{
  "title": "任务标题",
  "description": "补充描述（可选）",
  "priority": 1|2|3|4,
  "due_time": "YYYY-MM-DD HH:mm" | null,
  "recurrence_type": "daily"|"weekly"|"monthly"|null,
  "recurrence_days": [1,3,5] | null,
  "estimated_pomodoro": number | null,
  "confidence": 0-1 小数
}

规则:
- 标题简洁准确，去除"我要""需要"等冗余词
- 优先级: 1=紧急 2=重要 3=一般 4=不急。出现"紧急""马上""deadline"=1
- 重复: "每天"→daily, "每周X"→weekly, "每月X号"→monthly
- 番茄钟: 提到"X分钟"的任务，estimated_pomodoro = ceil(X/25)
- 没有明确信息时用 null，不要编造
- 只返回 JSON，不要任何解释文字

示例输入: "每天健身30分钟，每周一下午3点开会，每月1号交房租"
示例输出:
[{"title":"健身","recurrence_type":"daily","estimated_pomodoro":2,"priority":3,"confidence":0.9,"due_time":null,"description":null,"recurrence_days":null},{"title":"开会","recurrence_type":"weekly","recurrence_days":[1],"due_time":"15:00","priority":3,"confidence":0.95,"description":null,"estimated_pomodoro":null},{"title":"交房租","recurrence_type":"monthly","priority":3,"confidence":0.9,"due_time":null,"description":null,"estimated_pomodoro":null,"recurrence_days":null}]
```

### 5.4 首次使用引导

检测到 Ollama 未安装/未运行时，智能输入栏下方显示一行轻提示:
> "💡 安装 Ollama 可以理解更复杂的任务描述（免费/本地/离线）。[了解详情]"

不弹窗，不强推，就一行文字。

## 6. 类型定义

```typescript
// src/shared/types/ai.ts

export interface ParseResult {
  title: string;              // 任务名称
  description?: string;       // 描述
  priority: Priority;         // 推断的优先级，默认 P3
  due_time?: number;          // 截止时间戳（毫秒）
  recurrence_type?: string;   // 'daily' | 'weekly' | 'monthly' | null
  recurrence_days?: number[]; // [1,3,5] = 周一三五（解析阶段为 number[]）
  estimated_pomodoro?: number;
  reminder_offset?: number;   // 提前X分钟提醒（解析阶段为 number）
  category_id?: string;
  confidence: number;         // 0-1
  ai_hint: string;            // "已自动填写「重复：每天」"
}

// 重要：recurrence_days 在 CreateTaskInput 中是 string | null（JSON 序列化存储）
// 解析器输出 number[]，写入 DB 前需 JSON.stringify(recurrence_days)
// 示例: parser 产出 [1,3,5] → 传给 createTask 时: { recurrence_days: "[1,3,5]" }

// ai_meta 存储格式 (JSON string):
export interface AIMeta {
  source: 'regex' | 'ollama';
  confidence: number;
  raw_input: string;
  parsed_at: number; // Date.now()
}
```

## 7. IPC 通道注册

### 7.1 ipc.ts 新增

```typescript
// src/shared/types/ipc.ts — IPC_CHANNELS 新增:
AI: {
  PARSE: 'ai:parse',
},
```

### 7.2 preload.ts 新增

```typescript
// FocusFlowAPI 接口新增:
ai: {
  parse: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.AI.PARSE, text),
}
```

### 7.3 main.ts 注册

```typescript
// 在 registerTaskIpcHandlers 之后添加:
registerAIIpcHandlers();
```

## 8. 与现有功能的兼容性

| 现有功能 | 影响 |
|---------|------|
| TaskForm 编辑框 | ✅ 完全复用，只新增 pre-fill 逻辑 |
| recurrence.service 重复服务 | ✅ AI 写入标准 recurrence 字段，服务自然接管 |
| 数据库 schema | ✅ `ai_meta` 字段已存在，不新增列 |
| TaskList 列表 | ✅ SmartInput 常驻标题下方，WeekStrip 在它下面展开，不冲突 |
| 模板系统 | ✅ 不冲突 |
| 番茄钟 | ✅ 不冲突 |
| 日历视图（WeekStrip / MonthGrid） | ✅ SmartInput 在 WeekStrip 上方，互不影响 |
| 拖拽排序 | ✅ 不冲突 |

## 9. 待定事项

- 无。所有决策已确认。

## 10. 实现顺序

1. 类型定义 (`ai.ts` + `ipc.ts` 新增 channel)
2. 规则引擎 (`ai-parser.service.ts` — RegexParser)
3. Ollama 集成 (`ai-parser.service.ts` — OllamaParser)
4. IPC 通道 (`ai.ipc.ts`)
5. Preload 暴露 + main.ts 注册 (`preload.ts` + `main.ts`)
6. SmartInput 组件 (`SmartInput.tsx`)
7. TaskList 集成 (`TaskList.tsx`)
8. 逐个确认流程（改造 TaskForm 支持 pre-fill + 队列模式）

## 11. 修订记录

| 日期 | 修订内容 |
|------|---------|
| 2026-06-16 | 修复 9 个审查问题：recurrence_days 类型转换说明、IPC channel 注册、SmartInput 与 WeekStrip 排列顺序、Ollama 超时分首调/后续、ai_meta 存储格式、空输入/零结果处理、表单关闭行为定义、提醒偏移解析、完整 system prompt |
