# 每日任务迁移 & target_date — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `target_date` 字段驱动每日任务归属，替换 DailyMigrationDialog 为全内容区每日回顾面板，日历按 target_date 分组。

**Architecture:** 数据层新增 TEXT 列 + 迁移 → Repository 支持 clone → IPC 暴露 clone handler → Store 层 cloneTasksToToday → 新建 DailyReview 面板 → MonthGrid/TaskList 改用 target_date 筛选 → AppLayout 嵌入面板、更新 trigger。

**Tech Stack:** Electron + React + TypeScript + Zustand + SQLite (sql.js) + Tailwind CSS

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/shared/utils/date.ts` | ✨ 新建 | `toLocalDateStr` 本地日期辅助函数 |
| `src/shared/types/task.ts` | 🔧 修改 | `target_date` 字段加入所有类型 |
| `src/shared/types/ipc.ts` | 🔧 修改 | 新增 `CLONE_TASKS` channel |
| `src/electron-main/db/migrations.ts` | 🔧 修改 | v5 migration: 新增列 + 数据回填 |
| `src/electron-main/repositories/task.repository.ts` | 🔧 修改 | create/update 支持 target_date，新增 clone 方法 |
| `src/electron-main/ipc/task.ipc.ts` | 🔧 修改 | 注册 cloneTasks handler |
| `src/electron-main/preload/preload.ts` | 🔧 修改 | 暴露 `cloneTasks` API |
| `src/store/useTaskStore.ts` | 🔧 修改 | 新增 `cloneTasksToToday` 方法 |
| `src/components/tasks/TaskForm.tsx` | 🔧 修改 | 新建任务默认 target_date = today |
| `src/components/tasks/MonthGrid.tsx` | 🔧 修改 | due_time → target_date 分组 |
| `src/components/tasks/TaskList.tsx` | 🔧 修改 | 日期筛选字段改为 target_date |
| `src/components/tasks/DailyReview.tsx` | ✨ 新建 | 每日回顾全内容区面板 |
| `src/components/layout/AppLayout.tsx` | 🔧 修改 | 嵌入 DailyReview，删除旧 Dialog trigger |
| `src/components/tasks/DailyMigrationDialog.tsx` | 💀 删除 | 旧弹窗组件 |

---

### Task 1: 基础设施 — 日期工具 + 类型 + IPC channel

**Files:**
- Create: `src/shared/utils/date.ts`
- Modify: `src/shared/types/task.ts`
- Modify: `src/shared/types/ipc.ts`

- [ ] **Step 1: 创建 `src/shared/utils/date.ts`**

```typescript
// src/shared/utils/date.ts

/** 返回本地日期字符串 'YYYY-MM-DD'。
 *  禁止使用 toISOString()——它是 UTC，跨时区会差一天。 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

- [ ] **Step 2: `TaskRow`、`CreateTaskInput`、`UpdateTaskInput` 新增 `target_date`**

在 `src/shared/types/task.ts`：

`TaskRow` 末尾（`updated_at` 之后）新增：
```typescript
target_date: string;  // 'YYYY-MM-DD'
```

`CreateTaskInput` 新增：
```typescript
target_date?: string;
```

`UpdateTaskInput` 新增：
```typescript
target_date?: string;
```

- [ ] **Step 3: IPC_CHANNELS 新增 CLONE_TASKS**

在 `src/shared/types/ipc.ts`，`TASK` 对象内新增：
```typescript
CLONE_TASKS: 'db:task:cloneTasks',
```

- [ ] **Step 4: 验证类型编译**

```bash
cd "C:\Users\EDY\WorkBuddy\2026-06-10-10-03-48\focusflow" && npx tsc --noEmit
```

> **注意：** tsc 会报 test helper 中 `mockTask`/`makeTask` 缺少 `target_date`。在相应测试文件中加上 `target_date: ''`（默认空字符串）即可。

- [ ] **Step 5: 运行现有测试确保无回归**

```bash
npm test
```

**Condition:** 如果你提前拿到了 Cloudflare Worker URL，可以在 clone handler 阶段顺便替换 AI 解析逻辑，但不在本次 plan 范围。

- [ ] **Step 6: Commit**

```bash
git add src/shared/utils/date.ts src/shared/types/task.ts src/shared/types/ipc.ts
git commit -m "feat: add toLocalDateStr utility + target_date types + IPC clone channel"
```

---

### Task 2: 数据库迁移 v5 — 新增列 + 数据回填

**Files:**
- Modify: `src/electron-main/db/migrations.ts`

- [ ] **Step 1: 添加 migration v5**

在 `migrations` 数组末尾（v4 之后）添加：

```typescript
{
  version: 5,
  up(db: Database) {
    // 新增 target_date 列
    db.exec(`
      ALTER TABLE tasks ADD COLUMN target_date TEXT DEFAULT '';
    `);

    // 数据回填：有 due_time 取日期部分，否则取 created_at 日期部分
    const tasks = execQueryAll<{ id: string; due_time: number | null; created_at: number }>(
      db,
      'SELECT id, due_time, created_at FROM tasks WHERE target_date = ?',
      ['']
    );

    const updateStmt = db.prepare('UPDATE tasks SET target_date = ? WHERE id = ?');
    for (const task of tasks) {
      const ts = task.due_time ?? task.created_at;
      const d = new Date(ts);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      updateStmt.run([dateStr, task.id]);
    }
    updateStmt.free();
  },
},
```

需要文件顶部加 import：
```typescript
import { execQueryAll } from '../db/database';
```

检查是否已有 import——当前 migrations.ts 只从 `sql.js` import 了 `Database`。如果 `execQueryAll` 不存在于 database.ts，改用手动 prepare + step。

实际上 migrations.ts 的 seed.ts 里已经在用 `execQueryAll` 了……让我检查。migrations.ts 目前没有 import `execQueryAll`。v5 迁移里需要遍历已有任务，换一种方式——直接用 sql.js 的 prepare/step 循环，避免引入新依赖：

```typescript
{
  version: 5,
  up(db: Database) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN target_date TEXT DEFAULT '';
    `);

    // 回填已有数据：遍历所有 task，target_date 取 due_time 或 created_at 的日期部分
    const selectStmt = db.prepare('SELECT id, due_time, created_at FROM tasks');
    const updateStmt = db.prepare('UPDATE tasks SET target_date = ? WHERE id = ?');

    while (selectStmt.step()) {
      const row = selectStmt.getAsObject() as { id: string; due_time: number | null; created_at: number };
      const ts = row.due_time ?? row.created_at;
      const d = new Date(ts);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      updateStmt.run([dateStr, row.id]);
    }

    selectStmt.free();
    updateStmt.free();
  },
},
```

这样可以，但注意 `selectStmt.step()` 返回 boolean（不是 Promise），所以不用 await。同时 `updateStmt.run` 也是同步的。

等一下，有个问题：v5 迁移里使用了 `ALTER TABLE` 新增列。sql.js 的 SQLite 是否支持 `ALTER TABLE ADD COLUMN`？sql.js 底层是 SQLite compiled to WASM，应该支持。但我需要确认——之前的 migration v3 已经用过 ALTER TABLE 了：

```javascript
{
  version: 3,
  up(db: Database) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN recurrence_days TEXT;
    `);
  },
},
```

所以 ALTER TABLE 可用。好的。

- [ ] **Step 2: 验证迁移脚本语法**

```bash
cd "C:\Users\EDY\WorkBuddy\2026-06-10-10-03-48\focusflow" && npx tsc --noEmit
```

- [ ] **Step 3: 手动验证迁移——启动 App，确保不崩溃**

```bash
npm run dev
```

检查终端无 SQL 错误，App 正常加载。然后关闭 App。

- [ ] **Step 4: 验证数据回填——打开 DevTools，检查 localStorage 数据或 SQLite DB**

可以用一个快速脚本检查数据库中的 target_date 列：
```bash
# 在项目目录下，检查生成的 dist-electron 中的 db 文件
# 或用 sql.js 临时脚本
```

实际上最简单的方式：启动 App 后，在渲染进程 console 里执行 `window.api.db.listTasks({}).then(r => console.log(r.data?.map(t => t.target_date)))`，确认所有任务都有 target_date。

- [ ] **Step 5: Commit**

```bash
git add src/electron-main/db/migrations.ts
git commit -m "feat: add migration v5 — target_date column + data backfill"
```

---

### Task 3: TaskRepository — 支持 target_date + clone

**Files:**
- Modify: `src/electron-main/repositories/task.repository.ts`

- [ ] **Step 1: `create` 方法新增 `target_date`**

在 `create` 方法中：

INSERT 语句列列表新增 `target_date`：
```typescript
const stmt = this.db.prepare(`
  INSERT INTO tasks (
    id, title, description, priority, status, progress,
    start_time, due_time, reminder_time, recurrence_type, recurrence_days,
    category_id, parent_id, sort, estimated_pomodoro, ai_meta,
    target_date,
    created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?,
    ?, ?
  )
`);
```

参数列表新增（在 `ai_meta` 和 `now` 之间）：
```typescript
stmt.run([
  id,
  input.title,
  input.description ?? '',
  input.priority ?? 3,
  input.status ?? 'todo',
  input.progress ?? 0,
  input.start_time ?? null,
  input.due_time ?? null,
  input.reminder_time ?? null,
  input.recurrence_type ?? null,
  input.recurrence_days ?? null,
  input.category_id ?? null,
  input.parent_id ?? null,
  input.sort ?? 0,
  input.estimated_pomodoro ?? 0,
  input.ai_meta ?? null,
  input.target_date ?? '',   // ← 新增
  now,
  now,
]);
```

- [ ] **Step 2: `update` 方法新增 `target_date` mapping**

在 `mappings` 数组中新增一行：
```typescript
['target_date', 'target_date'],
```

- [ ] **Step 3: 新增 `cloneTasks` 方法**

在 `TaskRepository` 类中新增：

```typescript
/**
 * Clone tasks: create new copies with target_date set to today.
 * Copies task-definition fields only (title, description, priority,
 * status, progress, category_id, estimated_pomodoro).
 * Does NOT copy time/reminder/recurrence/parent/ai_meta fields.
 *
 * @returns Array of newly created TaskRow objects
 */
cloneTasks(taskIds: string[], todayDateStr: string): TaskRow[] {
  const selectStmt = this.db.prepare(
    `SELECT * FROM tasks WHERE id = ?`
  );
  const insertStmt = this.db.prepare(`
    INSERT INTO tasks (
      id, title, description, priority, status, progress,
      category_id, estimated_pomodoro,
      target_date,
      start_time, due_time, reminder_time, recurrence_type, recurrence_days,
      parent_id, sort, ai_meta,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?,
      NULL, NULL, NULL, NULL, NULL,
      NULL, 0, NULL,
      ?, ?
    )
  `);

  const cloned: TaskRow[] = [];
  const now = Date.now();

  for (const taskId of taskIds) {
    const result = selectStmt.bind([taskId]);
    if (!selectStmt.step()) {
      selectStmt.reset();
      continue;
    }
    const row = selectStmt.getAsObject() as TaskRow;
    selectStmt.reset();

    const newId = crypto.randomUUID();

    insertStmt.run([
      newId,
      row.title,
      row.description,
      row.priority,
      row.status,
      row.progress,
      row.category_id,
      row.estimated_pomodoro,
      todayDateStr,
      now,
      now,
    ]);

    const newTask = this.getById(newId);
    if (newTask) cloned.push(newTask);
  }

  selectStmt.free();
  insertStmt.free();

  return cloned;
}
```

- [ ] **Step 4: 编译验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/electron-main/repositories/task.repository.ts
git commit -m "feat: TaskRepository — support target_date in create/update + cloneTasks method"
```

---

### Task 4: IPC handler — cloneTasks

**Files:**
- Modify: `src/electron-main/ipc/task.ipc.ts`

- [ ] **Step 1: 注册 cloneTasks IPC handler**

在 `registerTaskIpcHandlers` 函数末尾（`LIST` handler 之后）新增：

```typescript
ipcMain.handle(
  IPC_CHANNELS.TASK.CLONE_TASKS,
  async (_event, taskIds: string[], todayDateStr: string): Promise<IPCResponse<TaskRow[]>> => {
    try {
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return { success: false, error: 'Invalid input: taskIds must be a non-empty array' };
      }
      if (!todayDateStr || typeof todayDateStr !== 'string') {
        return { success: false, error: 'Invalid input: todayDateStr is required' };
      }
      const cloned = repo.cloneTasks(taskIds, todayDateStr);
      // Broadcast each clone as an insert
      for (const task of cloned) {
        broadcastSync('insert', [task.id], task);
      }
      return { success: true, data: cloned };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
);
```

- [ ] **Step 2: 编译验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/electron-main/ipc/task.ipc.ts
git commit -m "feat: register cloneTasks IPC handler"
```

---

### Task 5: Preload + Store — 暴露 clone API + store 方法

**Files:**
- Modify: `src/electron-main/preload/preload.ts`
- Modify: `src/store/useTaskStore.ts`

- [ ] **Step 1: preload 暴露 `cloneTasks`**

在 `preload.ts` 的 `dbApi` 对象中新增：

```typescript
cloneTasks: (taskIds: string[], todayDateStr: string): Promise<IPCResponse<TaskRow[]>> =>
  ipcRenderer.invoke(IPC_CHANNELS.TASK.CLONE_TASKS, taskIds, todayDateStr),
```

需要确认 `IPC_CHANNELS.TASK.CLONE_TASKS` 的类型能通过。IPC_CHANNELS 是 `as const`，所以 `.TASK.CLONE_TASKS` 有字面量类型。

- [ ] **Step 2: `useTaskStore` 新增 `cloneTasksToToday`**

在 `TaskState` interface 中新增：
```typescript
cloneTasksToToday: (taskIds: string[]) => Promise<TaskRow[]>;
```

在 `create` 实现中新增方法：
```typescript
cloneTasksToToday: async (taskIds: string[]) => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const response = await window.api.db.cloneTasks(taskIds, dateStr);
  if (response.success && response.data) {
    // Sync broadcast will add cloned tasks to state automatically
    return response.data;
  }
  return [];
},
```

注：cloneTasks 在 main process 里已经 broadcast insert sync 事件，所以 renderer 的 `handleSync` 会自动把新 task 加到 store 里。这里不需要手动 set。

- [ ] **Step 3: 编译验证 + 测试**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/electron-main/preload/preload.ts src/store/useTaskStore.ts
git commit -m "feat: expose cloneTasks API in preload + store cloneTasksToToday"
```

---

### Task 6: TaskForm — 新建任务默认 target_date

**Files:**
- Modify: `src/components/tasks/TaskForm.tsx`

- [ ] **Step 1: 新建任务模式下默认填入 target_date**

在 `handleSubmit` 中，新建任务（非 isEdit）的 `baseInput` 新增：

```typescript
const baseInput = {
  title: title.trim(),
  description: description.trim(),
  priority,
  category_id: categoryId || null,
  due_time: dueTimeValue,
  reminder_time: reminderTimeValue,
  recurrence_type: recurrenceType || null,
  recurrence_days: recurrenceDays.length > 0 ? JSON.stringify(recurrenceDays) : null,
  estimated_pomodoro: pomodoro,
  target_date: toLocalDateStr(new Date()),  // ← 新增
};
```

需要在文件顶部新增 import：
```typescript
import { toLocalDateStr } from '../../shared/utils/date';
```

`target_date` 也可以在编辑任务时通过 baseInput 传入（UpdateTaskInput 已经包含 target_date），现在不需要额外处理——编辑时不改 target_date。

- [ ] **Step 2: 编译验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskForm.tsx
git commit -m "feat: TaskForm defaults target_date to today for new tasks"
```

---

### Task 7: MonthGrid — 按 target_date 分组

**Files:**
- Modify: `src/components/tasks/MonthGrid.tsx`

- [ ] **Step 1: `getTasksForDate` 改用 `target_date`**

将：
```typescript
function getTasksForDate(tasks: TaskRow[], dateStr: string): TaskRow[] {
  return tasks.filter((t) => {
    if (!t.due_time) return false;
    return new Date(t.due_time).toISOString().slice(0, 10) === dateStr;
  });
}
```

改为：
```typescript
function getTasksForDate(tasks: TaskRow[], dateStr: string): TaskRow[] {
  return tasks.filter((t) => t.target_date === dateStr);
}
```

- [ ] **Step 2: `dotsMap` useMemo 改用 `target_date`**

将：
```typescript
const dotsMap = useMemo(() => {
  const map = new Map<string, Priority[]>();
  for (const task of tasks) {
    if (!task.due_time) continue;
    const d = new Date(task.due_time);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dateStr = d.toISOString().slice(0, 10);
      if (!map.has(dateStr)) {
        map.set(dateStr, getPrioritiesForDate(tasks, dateStr));
      }
    }
  }
  return map;
}, [tasks, year, month]);
```

改为：
```typescript
const dotsMap = useMemo(() => {
  const map = new Map<string, Priority[]>();
  for (const task of tasks) {
    if (!task.target_date) continue;
    const [y, m] = task.target_date.split('-').map(Number);
    if (y === year && m === month + 1) {
      if (!map.has(task.target_date)) {
        map.set(task.target_date, getPrioritiesForDate(tasks, task.target_date));
      }
    }
  }
  return map;
}, [tasks, year, month]);
```

- [ ] **Step 3: 更新 MonthGrid 测试**

`src/components/tasks/__tests__/MonthGrid.test.tsx` 需要更新——把 `due_time` 改为 `target_date`：

在 `makeTask` 函数中新增：
```typescript
target_date: overrides.target_date ?? '',
```

在 `makeTask` 中删除 `due_time` 字段（或保留默认 null，不影响新逻辑）。

`getTasksForDate` 函数（测试内部 replicate）改为：
```typescript
function getTasksForDate(tasks: TaskRow[], dateStr: string): TaskRow[] {
  return tasks.filter((t) => t.target_date === dateStr);
}
```

`getPrioritiesForDate` 函数改为调用新的 `getTasksForDate`（逻辑不变）。

测试数据改为用 `target_date`：
```typescript
it('getTasksForDate returns tasks matching a given date', () => {
  const tasks: TaskRow[] = [
    makeTask({ id: 't1', title: 'A', target_date: '2026-06-16' }),
    makeTask({ id: 't2', title: 'B', target_date: '2026-06-17' }),
    makeTask({ id: 't3', title: 'C', target_date: '' }),
  ];

  const jun16 = getTasksForDate(tasks, '2026-06-16');
  expect(jun16).toHaveLength(1);
  expect(jun16[0].title).toBe('A');
});

it('getTasksForDate excludes tasks with no target_date', () => {
  const tasks: TaskRow[] = [
    makeTask({ id: 't1', title: 'No date', target_date: '' }),
  ];

  const result = getTasksForDate(tasks, '2026-06-16');
  expect(result).toHaveLength(0);
});

it('getPrioritiesForDate deduplicates and limits to 4', () => {
  const tasks: TaskRow[] = [
    makeTask({ id: 't1', priority: 1, target_date: '2026-06-16' }),
    makeTask({ id: 't2', priority: 1, target_date: '2026-06-16' }),
    makeTask({ id: 't3', priority: 2, target_date: '2026-06-16' }),
    makeTask({ id: 't4', priority: 3, target_date: '2026-06-16' }),
    makeTask({ id: 't5', priority: 4, target_date: '2026-06-16' }),
    makeTask({ id: 't6', priority: 1, target_date: '2026-06-16' }),
  ];

  const priorities = getPrioritiesForDate(tasks, '2026-06-16');
  expect(priorities).toHaveLength(4);
  expect(priorities).toContain(1);
  expect(priorities).toContain(2);
  expect(priorities).toContain(3);
  expect(priorities).toContain(4);
});
```

- [ ] **Step 4: 编译 + 测试**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/MonthGrid.tsx
git commit -m "feat: MonthGrid uses target_date instead of due_time for grouping"
```

---

### Task 8: TaskList + DayStrip + WeekStrip — 日期筛选改为 target_date

**Files:**
- Modify: `src/components/tasks/TaskList.tsx`
- Modify: `src/components/tasks/DayStrip.tsx`
- Modify: `src/components/tasks/WeekStrip.tsx`

- [ ] **Step 1: TaskList — `displayTasks` 中的日期筛选改用 `target_date`**

将：
```typescript
// Date filter (client-side — does not pollute store.tasks, so WeekStrip dots stay intact)
if (selectedDate) {
  result = result.filter((t) => {
    if (!t.due_time) return false;
    return new Date(t.due_time).toISOString().slice(0, 10) === selectedDate;
  });
}
```

改为：
```typescript
// Date filter (client-side — by target_date)
if (selectedDate) {
  result = result.filter((t) => t.target_date === selectedDate);
}
```

- [ ] **Step 2: DayStrip — `todayTasks` 改用 `target_date`**

在 `src/components/tasks/DayStrip.tsx`，`todayTasks` useMemo 从按 `due_time` 范围过滤改为按 `target_date`：

```typescript
import { toLocalDateStr } from '../../shared/utils/date';

// ...

const todayTasks = useMemo(() => {
  const todayStr = toLocalDateStr(new Date());
  return tasks.filter(
    (t) =>
      t.target_date === todayStr &&
      t.progress < 100 &&
      t.status !== 'cancelled'
  );
}, [tasks]);
```

删除 `todayStart`/`todayEnd` 时间戳计算。

- [ ] **Step 3: WeekStrip — `getPrioritiesForDate` 改用 `target_date`**

在 `src/components/tasks/WeekStrip.tsx`，`getPrioritiesForDate` 函数从按 `due_time` 过滤改为按 `target_date`：

```typescript
function getPrioritiesForDate(tasks: TaskRow[], dateStr: string): Priority[] {
  const priorities = tasks
    .filter((t) => t.target_date === dateStr)
    .map((t) => t.priority);
  return [...new Set(priorities)].slice(0, 4);
}
```

同时将 `handleDateClick` 和 `dotsMap` 中的 `day.toISOString().slice(0, 10)` 改为 `toLocalDateStr(day)`。

文件顶部加 import：
```typescript
import { toLocalDateStr } from '../../shared/utils/date';
```

- [ ] **Step 3: 编译验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/TaskList.tsx
git commit -m "feat: TaskList date filter uses target_date instead of due_time"
```

---

### Task 9: DailyReview — 新建每日回顾面板

**Files:**
- Create: `src/components/tasks/DailyReview.tsx`

- [ ] **Step 1: 创建 `DailyReview.tsx`**

```typescript
import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import type { TaskRow } from '../../shared/types/database';
import { Priority, TaskStatus } from '../../shared/types/database';
import { getPriorityLabel } from '../../shared/types/database';

interface DailyReviewProps {
  yesterdayTasks: TaskRow[];
  onSkip: () => void;
  onMigrate: (taskIds: string[]) => void;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-blue-500',
  4: 'text-gray-400',
};

const PRIORITY_BG: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-blue-500',
  4: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  todo: '待开始',
  in_progress: '进行中',
  paused: '暂停',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '🌙 夜深了';
  if (h < 12) return '👋 早上好';
  if (h < 18) return '☀️ 下午好';
  return '🌆 晚上好';
}

export const DailyReview: React.FC<DailyReviewProps> = ({
  yesterdayTasks,
  onSkip,
  onMigrate,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(yesterdayTasks.map((t) => t.id))
  );

  const toggleTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(yesterdayTasks.map((t) => t.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[today.getDay()];

  const stats = useMemo(() => {
    const totalPomodoros = yesterdayTasks.reduce(
      (sum, t) => sum + (t.estimated_pomodoro || 0), 0
    );
    const avgProgress = yesterdayTasks.length > 0
      ? Math.round(yesterdayTasks.reduce((sum, t) => sum + t.progress, 0) / yesterdayTasks.length)
      : 0;
    return {
      total: yesterdayTasks.length,
      pomodoros: totalPomodoros,
      avgProgress,
    };
  }, [yesterdayTasks]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}，新的一天
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {dateStr} · {weekday}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            跳过 →
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="px-8 mb-6 grid grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-red-500 tabular-nums">
            {stats.total}
          </div>
          <div className="text-xs text-muted-foreground mt-1">昨日遗留</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-primary tabular-nums">
            🍅 {stats.pomodoros}
          </div>
          <div className="text-xs text-muted-foreground mt-1">待完成番茄钟</div>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-500 tabular-nums">
            {stats.avgProgress}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">昨日平均进度</div>
        </div>
      </div>

      {/* Task list */}
      <div className="px-8 flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">
            选择要迁移到今天继续的任务
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button onClick={selectAll} className="hover:text-foreground transition-colors">
              全选
            </button>
            <button onClick={deselectAll} className="hover:text-foreground transition-colors">
              取消全选
            </button>
            <span>已选 {selectedIds.size}/{yesterdayTasks.length}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {yesterdayTasks.map((task) => {
            const isSelected = selectedIds.has(task.id);
            return (
              <label
                key={task.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:bg-accent/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTask(task.id)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block">
                    {task.title}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    {/* Mini progress bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {task.progress}%
                      </span>
                    </div>
                    {/* Pomodoro info */}
                    {task.estimated_pomodoro > 0 && (
                      <span className="text-xs text-muted-foreground">
                        🍅 {task.estimated_pomodoro}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0 ${
                    PRIORITY_BG[task.priority] || 'bg-gray-400'
                  }`}
                >
                  P{task.priority}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-8 py-5 border-t border-border mt-4">
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onSkip}>
            全部跳过
          </Button>
          <Button
            onClick={() => onMigrate(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
          >
            ✅ 确认迁移 ({selectedIds.size})
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 编译验证**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/DailyReview.tsx
git commit -m "feat: add DailyReview full-content-area migration panel"
```

---

### Task 10: AppLayout — 嵌入 DailyReview，替换旧 Dialog

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Delete: `src/components/tasks/DailyMigrationDialog.tsx`

- [ ] **Step 1: 替换 import**

移除：
```typescript
import { DailyMigrationDialog } from '../tasks/DailyMigrationDialog';
```

新增：
```typescript
import { DailyReview } from '../tasks/DailyReview';
import { toLocalDateStr } from '../../shared/utils/date';
```

- [ ] **Step 2: 更新 trigger 逻辑**

将原来 `useEffect` 中的跨天检查（约第 87-126 行）替换为：

```typescript
useEffect(() => {
  const init = async () => {
    await loadTasks();
    loadCategories();
    initTaskSync();
    initCategorySync();
    initTagSync();

    // Daily review trigger
    const today = toLocalDateStr(new Date());
    const lastActiveDate = localStorage.getItem('focusflow-last-active-date');

    if (lastActiveDate && lastActiveDate !== today) {
      const state = useTaskStore.getState();
      const unfinished = state.tasks.filter(
        (t) =>
          t.target_date === lastActiveDate &&
          t.progress < 100 &&
          t.status !== 'cancelled'
      );
      if (unfinished.length > 0) {
        setYesterdayTasks(unfinished);
        setMigrationOpen(true);
      } else {
        localStorage.setItem('focusflow-last-active-date', today);
      }
    } else if (!lastActiveDate) {
      localStorage.setItem('focusflow-last-active-date', today);
    }
  };
  init();
}, []);
```

- [ ] **Step 3: 更新 DailyReview 嵌入位置**

当前 `currentView` switch：
```tsx
{currentView === 'focus' ? (
  <FocusView />
) : currentView === 'stats' ? (
  <StatsView tasks={tasks} />
) : (
  <TaskList ... />
)}
```

改为——DailyReview 面板打开时覆盖主内容区：

```tsx
{migrationOpen ? (
  <DailyReview
    yesterdayTasks={yesterdayTasks}
    onSkip={() => {
      setMigrationOpen(false);
      localStorage.setItem('focusflow-last-active-date', toLocalDateStr(new Date()));
    }}
    onMigrate={async (taskIds) => {
      setMigrationOpen(false);
      await migrateTasksToToday(taskIds);
      localStorage.setItem('focusflow-last-active-date', toLocalDateStr(new Date()));
    }}
  />
) : currentView === 'focus' ? (
  <FocusView />
) : currentView === 'stats' ? (
  <StatsView tasks={tasks} />
) : (
  <TaskList
    categoryId={selectedCategory}
    dragOverId={dragOverId}
  />
)}
```

同时删除底部独立的 `<DailyMigrationDialog ... />` JSX。

- [ ] **Step 4: 删除旧文件**

```bash
rm "C:\Users\EDY\WorkBuddy\2026-06-10-10-03-48\focusflow\src\components\tasks\DailyMigrationDialog.tsx"
```

- [ ] **Step 5: 编译 + 测试**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git rm src/components/tasks/DailyMigrationDialog.tsx
git commit -m "feat: replace DailyMigrationDialog with DailyReview full panel"
```

---

### Task 11: 端到端验证

- [ ] **Step 1: 启动 App**

```bash
cd "C:\Users\EDY\WorkBuddy\2026-06-10-10-03-48\focusflow" && npm run dev
```

- [ ] **Step 2: 创建几个任务，正常使用**

  - 创建任务 → 检查 target_date 是否默认填入今天
  - 编辑任务 → 不影响 target_date
  - 修改进度 → 正常
  - 标记完成 → 正常

- [ ] **Step 3: 模拟跨天触发**

  在 DevTools Console 执行：
  ```javascript
  localStorage.setItem('focusflow-last-active-date', '2026-06-15')
  ```
  然后刷新页面。应该弹出 DailyReview 面板，展示昨天（6/15）的未完成任务。

- [ ] **Step 4: 测试 clone 操作**

  - 勾选几个任务
  - 点击"确认迁移"
  - 检查 TaskList 中是否出现了新的克隆任务（target_date = 今天）
  - 检查原任务是否仍在（target_date = 昨天）且未变化

- [ ] **Step 5: 测试跳过**

  - 再次设置 `focusflow-last-active-date` 为昨天
  - 刷新 → 面板出现 → 点"跳过"
  - 面板关闭，原任务不动

- [ ] **Step 6: 验证日历**

  - 切换到统计页 → 日历 tab
  - 检查各日期是否有圆点（按 target_date）
  - 点击某日期 → 查看当天任务列表

- [ ] **Step 7: 验证无回归**

  - 所有现有功能：创建/编辑/删除/复制/番茄钟/便签/模板/拖拽排序
  - 运行 `npm test` 确保现有测试通过

---

### Task 12: 最终清理 + commit

- [ ] **Step 1: 运行全量测试**

```bash
npm test
```

- [ ] **Step 2: 检查是否有未清理的 import 或 dead code**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 最终 commit**

```bash
git add -A
git commit -m "feat: complete daily migration redesign with target_date + DailyReview panel"
```
