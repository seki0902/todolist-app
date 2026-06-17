# FocusFlow — 每日任务迁移 & target_date 字段

**日期:** 2026-06-16
**状态:** 已批准

---

## 背景

当前有两个功能缺失，根源是同一个数据模型缺口：

1. **每日迁移弹窗从未出现** — 多数任务没有 `due_time`，触发条件找不到"昨天的任务"
2. **日历点不开历史** — 没有字段记录"任务哪天活跃过"，无法按天查看过往任务

核心洞察：用户把 FocusFlow 当"每日习题集"——每天翻开新的一页，昨天的留在昨天，任务状态持续但归属日不同。

---

## 设计概览

| 决策 | 内容 |
|------|------|
| **数据模型** | tasks 表新增 `target_date TEXT DEFAULT ''`，'YYYY-MM-DD' 格式 |
| **弹窗触发** | 每天首次启动，查 `target_date = 昨天` 且 `progress < 100` 且 `status != 'cancelled'` |
| **弹窗形式** | 全内容区面板（每日回顾），含统计卡片 + 任务列表 + 进度/番茄钟信息 |
| **勾选操作** | Clone 选中任务：新 ID、`target_date = 今天`、保留进度/状态/优先级/分类 |
| **不勾选** | 原任务留在昨天，不改动 |
| **日历** | 按 `target_date` 分组展示，点任意日期即可查看当天任务 |
| **已有数据** | 一次性迁移：有 `due_time` 取日期部分，没有的取 `created_at` 日期部分 |

---

## 数据模型

### 新增字段

```
tasks.target_date  TEXT DEFAULT ''
```

示例："2026-06-16"。空字符串表示未分配日期。

### 为什么不是新表

不需要 `task_daily_active`。每个任务只需一个归属日。今天克隆昨天任务 → 新 row 自动拥有今天的 `target_date`。一个任务做 3 天 → 3 条 row，各自带不同的 `target_date`。简单直观。

### 与 `due_time` 的关系

- `target_date`：任务"属于哪一天的任务列表"（软概念，用于日常规划）
- `due_time`：任务截止时间（硬概念，用于提醒排序）

两者独立。一天可以有多条任务，某条可以额外有截止时间。

---

## 数据库迁移

### 新增列

```sql
ALTER TABLE tasks ADD COLUMN target_date TEXT DEFAULT '';
```

### 已有数据回填

```
target_date =
  if due_time is not null  → 取 due_time 的日期部分（'YYYY-MM-DD'）
  else                     → 取 created_at 的日期部分
```

确保迁移后每条已有任务都有归属日。

### 新建任务默认值

新建任务时 `target_date` 默认填入今天的本地日期。

日期格式化统一使用本地日期辅助函数（禁止 `toISOString()`——它是 UTC，跨时区会差一天）：

```typescript
// src/shared/utils/date.ts
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

---

## 每日回顾面板

### 触发条件

AppLayout 首次加载完成后：

1. 读 `localStorage['focusflow-last-active-date']`（格式 'YYYY-MM-DD'）
2. 若值 ≠ 今天：
   - 查询 `target_date = lastActiveDate` 且 `progress < 100` 且 `status != 'cancelled'` 的任务
   - 有结果 → 打开面板
   - 无结果 → 直接更新日期，不弹窗
3. 若未记录（首次启动）→ 写今天日期（'YYYY-MM-DD'），不弹窗

### 面板布局

```
👋 早上好 / 下午好 / 晚上好，新的一天
2026年6月16日 · 周二                           [跳过]

┌─────────┬─────────┬─────────┐
│ 3       │ 🍅 2    │ 60%     │
│ 昨日遗留 │ 待完成   │ 昨日完成 │
└─────────┴─────────┴─────────┘

选择要迁移到今天继续的任务              全选 · 已选 3/3

┌─────────────────────────────────────────┐
│ ☑ 完成设计文档       进度 70%  🍅 1/2  P1 进行中│
│ ☑ Code Review         进度 0%   未开始   P2 待开始│
│ ☑ 更新依赖版本         进度 30%           P3 暂停  │
└─────────────────────────────────────────┘

                          [全部跳过]  [✅ 确认迁移 (3)]
```

### 统计卡片

| 卡片 | 计算逻辑 |
|------|---------|
| 昨日遗留 | `target_date = 昨天` 且未完成的任务数 |
| 待完成番茄钟 | 这些任务的 `estimated_pomodoro` 总计 |
| 昨日完成率 | 昨天所有任务的 `progress` 平均值 |

### 任务列表项

每条显示：checkbox、标题、进度条、番茄钟状态（已完成/总计）、优先级标签、状态标签。

进度条以 mini bar 展示（灰色底 + 主题色填充），直观看出做到哪了。

### 交互

- **默认全选** — 所有任务 checkbox 勾上
- **全选 / 取消全选** — 文本按钮
- **跳过** — 关闭面板，原任务不动，写日期
- **确认迁移** — 批量 clone 勾选的任务，关闭面板，写日期

### Clone 逻辑

字段分为两类——**复制**（任务定义，跨天不变）和**不复制**（时间/层级/元数据，属于当天快照）：

| 分类 | 字段 | 理由 |
|------|------|------|
| ✅ 复制 | `title`, `description`, `priority`, `status`, `progress`, `category_id`, `estimated_pomodoro` | 任务核心属性，跨天延续 |
| ❌ 不复制 | `due_time`, `reminder_time` | 时间类，属于当天 |
| ❌ 不复制 | `recurrence_type`, `recurrence_days` | 重复规则，Clone 不继承 |
| ❌ 不复制 | `parent_id` | 层级关系，新任务独立 |
| ❌ 不复制 | `ai_meta` | AI 拆分元数据，不继承 |
| 🆕 新值 | `target_date` | 填入今天 |
| 🆕 新值 | `id` | 新 UUID |

> **维护提醒：** 给 `TaskRow` 加新字段时，判断它属于"任务定义"还是"当天快照"，更新此表。

```typescript
function cloneTaskForToday(task: TaskRow): CreateTaskInput {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    category_id: task.category_id,
    estimated_pomodoro: task.estimated_pomodoro,
    target_date: toLocalDateStr(new Date()),
  };
}
```

Clone 在 main process 的 task.ipc 中新增 `cloneTasksForToday` IPC handler，一次 SQL 事务完成所有 insert，广播 sync 事件到 renderer。

### 边界情况

- **昨天没有未完成任务** → 不弹窗，静默更新日期
- **用户点了"跳过"** → 原任务留在昨天，不会再次询问（日期已写）
- **同一个任务多天未完成** → 每天弹窗都会出现（因为对应的是不同的 clone：day1 的 clone、day2 的 clone，每个 `target_date` 不同）
- **跨天打开（比如凌晨 12 点之后）** → 正常触发，lastActiveDate 还是"昨天"

---

## 日历视图联动

### MonthGrid 改动

当前 MonthGrid 按 `due_time` 分组。改为按 `target_date` 分组：

```typescript
// 按 target_date 分组，而非 due_time
const tasksByDate = tasks
  .filter(t => t.target_date)
  .reduce((acc, t) => {
    (acc[t.target_date] ??= []).push(t);
    return acc;
  }, {} as Record<string, TaskRow[]>);
```

### 点击日期 → TaskList

点击日历日期后，设置 `selectedDate`，TaskList 按 `target_date` 筛选该日任务。

### TaskList 日期筛选

已有 `selectedDate` prop（来自日历重设计）。筛选逻辑改为：

```typescript
if (selectedDate) {
  result = result.filter(t => t.target_date === selectedDate);
}
```

仅当 `selectedDate` 为空时显示全部任务（不限日期）。

---

## 类型变更

### `TaskRow`（`src/shared/types/database.ts`）

新增：
```typescript
target_date: string;  // 'YYYY-MM-DD'
```

### `CreateTaskInput`

新增：
```typescript
target_date?: string;
```

### `UpdateTaskInput`

新增：
```typescript
target_date?: string;
```

### 商店方法

```typescript
// useTaskStore — 新增
cloneTasksToToday: (taskIds: string[]) => Promise<void>;
```

---

## 组件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 💀 删除 | `src/components/tasks/DailyMigrationDialog.tsx` | 小弹窗组件 |
| ✨ 新建 | `src/components/tasks/DailyReview.tsx` | 全内容区每日回顾面板 |
| 🔧 修改 | `src/components/layout/AppLayout.tsx` | 嵌入 DailyReview，更新 trigger 逻辑 |
| 🔧 修改 | `src/components/tasks/MonthGrid.tsx` | due_time → target_date 分组 |
| 🔧 修改 | `src/components/tasks/TaskList.tsx` | 日期筛选字段改为 target_date |
| 🔧 修改 | `src/components/tasks/TaskForm.tsx` | 新建任务默认 target_date = 今天 |
| 🔧 修改 | `src/electron-main/db/migrations.ts` | 新增列 + 回填 |
| 🔧 修改 | `src/electron-main/ipc/task.ipc.ts` | 新增 cloneTasksForToday handler |
| 🔧 修改 | `src/electron-main/repositories/task.repository.ts` | 支持 clone |
| 🔧 修改 | 所有 shared/types 相关文件 | 新增 target_date 字段 |

---

## 不做的

- **不自动追标原任务** — 克隆后原任务保持原样
- **不修改现有筛选逻辑** — `due_time` 筛选保留不变（用于截止日提醒场景）
- **不强制 target_date** — 允许空字符串，向后兼容手动创建的旧数据（但 UI 上新建任务默认填入）
- **不改变 TaskList 默认行为** — 无 `selectedDate` 时仍显示全部任务

---

## 风险与回滚

- **数据库迁移** — ALTER TABLE + 数据回填在本地 SQLite，风险极低，迁移失败不影响其他功能
- **日历联动** — MonthGrid 的 due_time → target_date 变更是纯 UI 层，不影响数据库
- **回滚** — `git revert` 即可，数据迁移是幂等的（新增列不影响已有列）
