# AI 智能任务拆分 — 设计文档

> 日期: 2026-06-11
> 状态: 已确认
> 应用: FocusFlow Desktop

## 1. 概述

在 FocusFlow 任务列表顶部新增一条「智能输入栏」，用户用自然语言描述要做的事（如 "每天健身30分钟，每周一下午3点开会，每月1号交房租"），系统自动解析成多个任务，逐个弹出编辑框让用户确认后批量创建。

**核心原则**: 不强制 AI，不要求用户配置 API Key，零额外成本。

## 2. 用户交互流程

```
用户输入自然语言 → 点击「智能解析」
  → 规则引擎/ Ollama 解析 → 返回 N 个 ParseResult
  → 逐个弹出 TaskForm 编辑框（预填 AI 识别字段）
  → 用户: 修改 → 保存 → 下一个
  → 全部确认或跳过 → 任务创建完成
```

### 2.1 智能输入栏

- **位置**: TaskList 顶部，标题区域和工具栏之间
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
  - 「全部跳过」— 放弃剩余所有解析结果
  - 「保存 → 下一个」— 创建当前任务，弹出下一个编辑框

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
    │  IPC: ai:parse { text: string }
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
| `src/components/tasks/TaskList.tsx` | 引入 SmartInput 组件，插入到标题和工具栏之间 |
| `src/electron-main/main/main.ts` | 注册 ai:parse IPC handler |
| `src/shared/types/ipc.ts` | 新增 `AI: { PARSE: 'ai:parse' }` channel |
| `src/electron-main/preload/preload.ts` | 暴露 `window.api.ai.parse(text)` 方法 |

## 4. 规则引擎设计

### 4.1 支持的模式

| 模式 | 正则 | 示例输入 | 输出 |
|------|------|---------|------|
| 每天 + 动作 | `每天(早上\|下午\|晚上)?(.+)` | "每天健身" | title=健身, recurrence=daily |
| 每周X + 时间 + 动作 | `每周([一二三四五六日天])(早上\|下午\|晚上)?(\d{1,2})?点?(.+)` | "每周一下午3点开会" | title=开会, recurrence=weekly, days=[1], due=15:00 |
| 每月X号 + 动作 | `每月(\d{1,2})[号日](.+)` | "每月1号交房租" | title=交房租, recurrence=monthly, dueDay=1 |
| 明天/后天 + 动作 | `(明天\|后天)(早上\|下午\|晚上)?(.+)` | "明天下午去超市" | title=去超市, due=明天/后天 |
| 优先级关键词 | `(紧急\|重要\|优先)` | "紧急：修复bug" | priority=P1 |
| 番茄钟提示 | `(\d+)分钟` | "学英语30分钟" | pomodoro 相关 |

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
  "prompt": "你是任务解析助手。把用户的自然语言输入拆成任务列表...",
  "stream": false,
  "options": { "num_predict": 512 }
}
```
- 超时: 5 秒
- 超时 → 回退到规则引擎结果

### 5.3 首次使用引导

检测到 Ollama 未安装/未运行时，智能输入栏下方显示一行轻提示:
> "💡 安装 Ollama 可以理解更复杂的任务描述（免费/本地/离线）。[了解详情]"

不弹窗，不强推，就一行文字。

## 6. 类型定义

```typescript
// src/shared/types/ai.ts

export interface ParseResult {
  title: string;           // 任务名称
  description?: string;    // 描述
  priority: Priority;      // 推断的优先级，默认 P3
  due_time?: number;       // 截止时间戳
  recurrence_type?: string; // 'daily' | 'weekly' | 'monthly' | null
  recurrence_days?: number[]; // [1,3,5] = 周一三五
  estimated_pomodoro?: number;
  category_id?: string;
  confidence: number;      // 0-1
  ai_hint: string;         // "已自动填写「重复：每天」"
}
```

## 7. 与现有功能的兼容性

| 现有功能 | 影响 |
|---------|------|
| TaskForm 编辑框 | ✅ 完全复用，只新增 pre-fill 逻辑 |
| recurrence.service 重复服务 | ✅ AI 写入标准 recurrence 字段，服务自然接管 |
| 数据库 schema | ✅ `ai_meta` 字段已存在，不新增列 |
| TaskList 列表 | ✅ 只插入一个 SmartInput，不改列表逻辑 |
| 模板系统 | ✅ 不冲突 |
| 番茄钟 | ✅ 不冲突 |
| 日历视图 | ✅ 不冲突 |
| 拖拽排序 | ✅ 不冲突 |

## 8. 待定事项

- 无。所有决策已确认。

## 9. 实现顺序

1. 类型定义 (`ai.ts`)
2. 规则引擎 (`ai-parser.service.ts` — RegexParser)
3. Ollama 集成 (`ai-parser.service.ts` — OllamaParser)
4. IPC 通道 (`ai.ipc.ts`)
5. Preload 暴露 (`preload.ts`)
6. SmartInput 组件 (`SmartInput.tsx`)
7. TaskList 集成 (`TaskList.tsx`)
8. 逐个确认流程（改造 TaskForm 支持 pre-fill + 队列模式）
