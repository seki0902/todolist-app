# FocusFlow 功能调整 — 技术设计文档

> 版本: v0.2.0-adjustments  
> 日期: 2026-06-11  
> 基于: MVP v0.1.0 现有代码  
> 调整条目: 12 项

---

## 概述

基于 MVP v0.1.0 的使用反馈，对 12 个功能点进行调整。所有调整保持现有技术栈不变（Electron + React + TypeScript + TailwindCSS + SQLite + Zustand），在现有架构上进行增量修改。

---

## 调整 1: 应用图标替换

**现状**: `build-resources/` 下图标视觉质量不佳。

**方案**:
- 替换 `build-resources/icon.ico`（Windows .ico 格式，需含 256x256/48x48/32x32/16x16）
- 替换 `build-resources/icon.png`（用于安装包）
- 同步更新 `public/` 下的 favicon/logo 资源
- `electron-builder.yml` 中图标路径无需修改（保持 `build-resources/icon.ico` 引用）

**影响文件**:
- `build-resources/icon.ico`（替换）
- `build-resources/icon.png`（替换）
- `public/` 下相关资源（替换）

**注意**: 需要设计师或图标生成工具产出新图标，代码无改动。

---

## 调整 2: 聚焦模式优先今日任务

**现状**: `FocusView` 中聚焦任务选择逻辑为:
```
inProgressTasks[0] → urgentTasks[0] → todayTasks[0] → nextUpTasks[0]
```
会优先展示历史遗留的"进行中"任务。

**方案**:
修改优先级逻辑为**今日优先**:
```
todayTasks[0] → urgentTasks[0] → inProgressTasks[0] → 无任务空态
```

**具体改动** (`src/components/layout/AppLayout.tsx` FocusView):
```typescript
// 修改前
const focusTask = inProgressTasks[0] || urgentTasks[0] || todayTasks[0] || nextUpTasks[0];

// 修改后：今日任务第一优先
const todayUrgent = todayTasks.filter(t => t.priority === 1);
const focusTask = todayUrgent[0] || todayTasks[0] || urgentTasks[0] || inProgressTasks[0];
```

移除 `nextUpTasks`（待开始低优先级任务不应成为焦点卡片的主角）。

**影响文件**:
- `src/components/layout/AppLayout.tsx`

---

## 调整 3: 跨天切换对话框

**现状**: 聚焦模式下方展示全部任务列表，无"今日"概念。

**方案**:

### 3a. 任务列表默认显示"今日任务"
- 在 `TaskList` 组件中新增 `defaultFilter` 概念
- 首次加载 / 聚焦模式下的任务列表默认筛选 `due_time` 为今天

### 3b. 跨天检测 + 迁移对话框
- 应用启动时（`AppLayout` 初始化），检查 `localStorage` 中的 `lastActiveDate`
- 若 `lastActiveDate` 不是今天 → 弹出 `DailyMigrationDialog`
- 对话框列出昨日未完成任务（`status = 'todo' | 'in_progress' | 'paused'` 且 `updated_at` 在昨天范围）
- 每项带复选框，默认全选，用户可取消勾选
- 用户确认后：
  - 选中的任务 `due_time` 更新为今天
  - 未选中的保持原样
- 点击"跳过"或关闭 → 不处理，记录今天为 `lastActiveDate`
- 更新 `lastActiveDate` 为今天

### 3c. 对话框 UI 设计
```
┌─────────────────────────────────────┐
│  👋 早上好！                         │
│                                     │
│  昨天有 3 个任务未完成，              │
│  是否移动到今天继续？                 │
│                                     │
│  [✅] 写剪辑需求     P1    待开始     │
│  [✅] 整理文件       P3    进行中     │
│  [ ]  周报草稿       P2    暂停       │
│                                     │
│  [全选] [取消全选]                    │
│                                     │
│    [跳过]          [移动到今天]       │
└─────────────────────────────────────┘
```

**影响文件**:
- `src/components/tasks/DailyMigrationDialog.tsx`（新增）
- `src/components/layout/AppLayout.tsx`（启动时检查 + 弹窗逻辑）
- `src/store/useTaskStore.ts`（新增 `migrateTasksToToday` 批量更新方法）

**数据库无变更**。

---

## 调整 4: 任务列表顶部内嵌迷你日视图

**现状**: 任务列表只有标题、搜索栏和筛选器。

**方案**:
在 TaskList 顶部（搜索栏上方或下方）添加一个**迷你今日日历条**：

- 显示今天日期（如：`6月11日 星期三`）
- 右侧显示今日任务数量统计条：`已完成 2 / 总数 5`
- 一个水平进度条显示今日完成比例
- 不引入 FullCalendar（日历 Tab 将被移除），仅用纯 UI 实现

**UI 示意**:
```
┌──────────────────────────────────────────────┐
│  📅  6月11日 星期三          ████░░ 40%  2/5  │
└──────────────────────────────────────────────┘
```

**影响文件**:
- `src/components/tasks/TaskList.tsx`（顶部新增 mini day strip）
- 或抽取为 `src/components/tasks/DayStrip.tsx`（新增）

---

## 调整 5: 移除独立日历 Tab，集成到任务列表

**现状**: 日历作为独立的侧边栏 Tab 页面，实用性低。

**方案**:

### 5a. 移除独立日历视图
- 从 `AppLayout` 侧边栏导航中移除"📅 日历"按钮
- 保留 `CalendarView.tsx` 组件文件不删除（未来可能以其他形式复用），但从路由中摘除
- `View` 类型缩减为 `'focus' | 'tasks' | 'stats'`

### 5b. 任务列表右上角迷你月历
- 在 TaskList 右上角添加一个可折叠的迷你月历（使用 FullCalendar 的 dayGridMonth 或自定义轻量实现）
- 点击迷你月历上的某一天 → 任务列表筛选该日期的任务
- 默认折叠，点击日历图标展开

**影响文件**:
- `src/components/layout/AppLayout.tsx`（移除日历导航按钮和 CalendarView 路由）
- `src/components/tasks/TaskList.tsx`（新增迷你月历区域）
- `src/components/tasks/CalendarView.tsx`（保留但不挂载）

---

## 调整 6: 便签模式钉选可配置

**现状**: `sticky.service.ts` 中 `alwaysOnTop: true`，便签永远浮在所有窗口上方。

**方案**:

### 6a. 默认改为不置顶
- 创建便签窗口时 `alwaysOnTop: false`
- `setAlwaysOnTop` 不再调用

### 6b. 右键菜单
- 在便签窗口中注册右键菜单（Electron `Menu` API 或 contextmenu 事件）
- 菜单项：
  - ☐ 固定在页面上方（勾选式，默认不勾选）
  - ──────────────
  - 透明度 20% / 40% / 60% / 80% / 100%（子菜单，当前值打勾）
  - ──────────────
  - 关闭便签

### 6c. 实现方式
- 在 `sticky.service.ts` 中通过 IPC 注册便签窗口的 `context-menu` 事件
- 或者在 `preload.ts` 中暴露 `showContextMenu` 方法
- 推荐方案：在 main process 中监听便签窗口的 `context-menu` 事件，直接构建原生 Menu

**影响文件**:
- `src/electron-main/services/sticky.service.ts`（修改窗口属性 + 注册右键菜单）
- `src/electron-main/preload/preload.ts`（如需要新增 IPC 通道）

---

## 调整 7: 分类名称中文化（数据库修复）

**现状**: seed 数据已经是中文（工作/学习/生活/项目），但用户侧边栏显示英文。原因：旧数据库已有英文分类数据，seed 跳过。

**方案**:
- 创建数据库迁移 v2：将 `categories` 表中 name 为英文的记录更新为中文
- 迁移脚本检查现有分类名称，按颜色/顺序匹配并更新

```sql
-- 迁移 v2: 确保分类名称为中文
UPDATE categories SET name = '工作' WHERE name = 'Work' OR name = 'work';
UPDATE categories SET name = '学习' WHERE name = 'Study' OR name = 'study';
UPDATE categories SET name = '生活' WHERE name = 'Life' OR name = 'life';
UPDATE categories SET name = '项目' WHERE name = 'Project' OR name = 'project';
```

**影响文件**:
- `src/electron-main/db/migrations.ts`（新增 migration v2）

---

## 调整 8: 新建任务继承分类上下文

**现状**: 在侧边栏选中某个分类后点"新建任务"，分类字段为空。

**方案**:
- `TaskList` 组件已有 `categoryId` prop（当前选中的分类）
- `AppLayout` 中新建任务按钮也需感知当前侧边栏选中分类
- 修改方案：
  - `TaskList` 中的"新建任务"按钮 → 传递 `categoryId` 给 TaskForm
  - `FocusView` 中的全局"新建任务"按钮 → 不继承分类（或也加一个快捷入口）

**具体改动**:
- `TaskList` 的 `handleSave` 中 `parentId` 逻辑已有，同理将 `categoryId` 作为默认值传入
- 实际上当前代码 `TaskForm` 接收 `categories` 但不接收默认 `categoryId`，需要新增 prop

**影响文件**:
- `src/components/tasks/TaskList.tsx`（传递 categoryId 给 TaskForm）
- `src/components/tasks/TaskForm.tsx`（新增 `defaultCategoryId` prop，open 时设定初始值）

---

## 调整 9: 新建任务弹窗响应式

**现状**: TaskForm Dialog 使用固定宽度的 `max-w-sm`（约 384px），窗口缩小时内容溢出。

**方案**:

### 9a. Dialog 组件改造
- `Dialog` 组件新增 `maxWidth` 限制：`max-w-[95vw] max-h-[90vh]`
- 内容区添加 `overflow-y-auto`，内部内容过长时可滚动
- 在小屏幕宽度下（< 500px），表单改为单列布局（`grid-cols-1` 替代 `grid-cols-2`）

### 9b. 使用 CSS 媒体查询或 Tailwind 响应式类
- `grid grid-cols-1 sm:grid-cols-2 gap-3` 用于优先级/状态行
- `grid grid-cols-1 sm:grid-cols-2 gap-3` 用于截止日期/番茄钟行
- Dialog 面板宽度：`w-full max-w-lg sm:max-w-xl md:max-w-2xl`

**影响文件**:
- `src/components/ui/Dialog.tsx`（面板尺寸调整）
- `src/components/tasks/TaskForm.tsx`（表单响应式 class）

---

## 调整 10: 番茄钟改为独立工作台 🔥

**这是本次最大调整，重新设计番茄钟的工作方式。**

**现状**: 番茄钟绑定在任务上，每个任务有 `estimated_pomodoro` 字段，在任务卡片 / 聚焦卡片上点"开始番茄钟"。

**目标**: 番茄钟是独立工作台——用户全局入口打开计时器 → 在计时器内选择要专注的任务 → 开始。

### 10a. 全局入口

- 在侧边栏导航中新增 🍅 番茄钟按钮（位于聚焦模式、全部任务、统计之后）
- 版本1（默认打开方式）：点开 → 弹出 PomodoroWorkbench 模态框，用户可先选任务再开始
- 版本2（快速模式）：如果当前聚焦视图有焦点任务，入口旁显示"快速开始"小按钮，直接用焦点任务开计时

### 10b. PomodoroWorkbench 组件（替代 PomodoroTimer）

新组件结构：
```
┌────────────────────────────────────────────┐
│  🍅 番茄钟                          [收起]  │
│                                            │
│  📋 专注任务: [搜索并选择任务...  ▼]        │
│                                            │
│     ┌──────────────────────┐               │
│     │     ⏱  25:00         │               │
│     │   ┌──────────────┐   │               │
│     │   │  圆形进度条   │   │               │
│     │   └──────────────┘   │               │
│     │  写剪辑需求 ✨        │               │
│     │  专注中...           │               │
│     └──────────────────────┘               │
│                                            │
│  时长: [15] [25] [35] [45] [60] 分钟       │
│                                            │
│  [开始] / [暂停] / [结束]                  │
│                                            │
│  ──────────────────────────────            │
│  历史:                                     │
│  · 写剪辑需求 — 25分钟 — 2分钟前           │
│  · UI设计    — 15分钟 — 1小时前            │
└────────────────────────────────────────────┘
```

### 10c. 任务选择器
- 下拉搜索选择框，列出所有未完成的任务
- 默认选中当前聚焦任务（若存在）
- 支持搜索过滤
- 任务被选择后，记录最近一次选择的 N 个任务用于快速切换

### 10d. 移除任务上的番茄钟预设
- 任务表单中**移除** `estimated_pomodoro` 字段
- 数据库保留该列（不破坏已有数据），但前端不再展示和编辑
- 任务卡片上不再显示 🍅 数量

### 10e. 番茄钟历史记录
- 使用 localStorage 存储完成记录（已有类似机制）
- 每条记录: `{ taskId, taskTitle, duration, completedAt }`
- 工作台下方展示最近 5 条
- 统计页面"累计番茄数"和"专注时长"从此记录计算

**影响文件**:
- `src/components/tasks/PomodoroTimer.tsx` → 重构或新建 `src/components/tasks/PomodoroWorkbench.tsx`
- `src/components/layout/AppLayout.tsx`（侧边栏加番茄钟入口，移除 FocusView 中的番茄钟按钮）
- `src/components/tasks/TaskForm.tsx`（移除 estimated_pomodoro 字段输入）
- `src/components/tasks/TaskItem.tsx`（移除番茄钟数量显示）
- `src/components/tasks/StatsView.tsx`（调整番茄钟统计的数据源）
- `src/store/`（可新增 `usePomodoroStore` 管理状态）

---

## 调整 11: 重复规则改为"每周哪几天"

**现状**: `recurrence_type` 为 `daily | weekly | monthly | yearly` 字符串。后台 `recurrence.service.ts` 根据此字段更新 `due_time`。

**方案**:

### 11a. 数据模型变更
- `recurrence_type` 字段扩展语义：新增 `weekly_days` 类型
- 新增字段 `recurrence_days`（JSON 字符串，如 `[1,3,5]` 表示周一、三、五）
  - 或直接用 `recurrence_type` 存储 JSON 字符串 `'weekly:[1,3,5]'`
- 推荐方案：新增 `recurrence_days TEXT` 列（JSON 数组），与 `recurrence_type='weekly'` 配合使用

### 11b. 数据库迁移
```sql
ALTER TABLE tasks ADD COLUMN recurrence_days TEXT;
```

### 11c. UI 变更
- 任务表单中，将"重复"下拉框改为：
  ```
  不重复 | 每周
  ```
- 选择"每周"后展开星期选择器（checkbox 组）：
  ```
  [✅] 周一  [ ] 周二  [✅] 周三  [ ] 周四  [✅] 周五  [ ] 周六  [ ] 周日
  ```
- 存入格式：`recurrence_type = 'weekly'`, `recurrence_days = '[1,3,5]'`

### 11d. 后台服务修改
- `recurrence.service.ts` 中，当 `recurrence_type='weekly'` 且 `recurrence_days` 有值时：
  - 计算下一个匹配的星期几
  - 更新 `due_time` 到下一个匹配日
- 保留 daily/monthly/yearly 支持（向后兼容，但 UI 不再暴露）

**影响文件**:
- `src/electron-main/db/migrations.ts`（新增 migration v3: ALTER TABLE tasks ADD recurrence_days）
- `src/electron-main/services/recurrence.service.ts`（支持 weekly_days 模式）
- `src/components/tasks/TaskForm.tsx`（替换重复选项 UI）
- `src/shared/types/task.ts`（`TaskRow` 和 `UpdateTaskInput` 新增 `recurrence_days`）
- `src/shared/types/database.ts`（同步更新）

---

## 调整 12: 番茄钟运行时可缩小为浮窗

**现状**: PomodoroTimer 是一个固定居中的模态弹窗，开始后没有最小化能力。

**方案**:

### 12a. 最小化状态
番茄钟运行时，如果用户点击"收起"按钮或切换视图：
- 计时器不中断
- 在主窗口右下角显示一个**浮窗胶囊**：

```
┌─────────────────┐
│ 🍅 24:32  写剪辑 │
└─────────────────┘
```

### 12b. 浮窗胶囊功能
- 显示剩余时间（实时更新）
- 显示当前任务标题（截断）
- 点击胶囊 → 展开回完整 PomodoroWorkbench
- 暂停时显示暂停图标
- 计时结束 → 胶囊变绿闪烁 3 秒 → 通知 → 自动消失（或保持显示"完成"状态）
- 可拖动位置（在主窗口内的绝对定位）

### 12c. 实现
- 在 `AppLayout` 中渲染浮窗（fixed position，bottom-right）
- 番茄钟状态由 `usePomodoroStore` 全局管理（而非 PomodoroTimer 组件内部 state）
- PomodoroStore 结构：

```typescript
interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  timeLeft: number;
  totalDuration: number;
  selectedTaskId: string | null;
  selectedTaskTitle: string | null;
  isMinimized: boolean;  // 是否收起为浮窗
  history: PomodoroRecord[];
  // actions...
}
```

- 将当前 PomodoroTimer 中的 state/ref 迁移到 Zustand store
- 浮窗组件 `PomodoroFloating.tsx` 订阅 store，运行时显示
- 可以在任何页面看到浮窗（因为挂载在 AppLayout 根层级）

**影响文件**:
- `src/store/usePomodoroStore.ts`（新建：全局番茄钟状态管理）
- `src/components/tasks/PomodoroWorkbench.tsx`（新建：替代 PomodoroTimer，使用 store）
- `src/components/tasks/PomodoroFloating.tsx`（新建：浮窗胶囊组件）
- `src/components/layout/AppLayout.tsx`（挂载 PomodoroWorkbench + PomodoroFloating）
- `src/components/tasks/PomodoroTimer.tsx`（可删除或保留作参考）

---

## 数据库迁移汇总

本次调整涉及 2 个新增迁移：

| 迁移版本 | 内容 | 对应调整 |
|----------|------|----------|
| v2 | 分类名称英文→中文修正 | #7 |
| v3 | tasks 表新增 `recurrence_days TEXT` | #11 |

---

## 文件变更总览

### 新增文件
| 文件 | 用途 | 对应调整 |
|------|------|----------|
| `src/components/tasks/DailyMigrationDialog.tsx` | 跨天迁移对话框 | #3 |
| `src/components/tasks/DayStrip.tsx` | 今日日期条组件 | #4 |
| `src/components/tasks/PomodoroWorkbench.tsx` | 独立番茄钟工作台 | #10, #12 |
| `src/components/tasks/PomodoroFloating.tsx` | 番茄钟浮窗胶囊 | #12 |
| `src/store/usePomodoroStore.ts` | 番茄钟全局状态 | #10, #12 |

### 修改文件
| 文件 | 涉及调整 |
|------|----------|
| `src/electron-main/db/migrations.ts` | #7, #11 |
| `src/components/layout/AppLayout.tsx` | #2, #3, #5, #10, #12 |
| `src/components/tasks/TaskList.tsx` | #3, #4, #5, #8 |
| `src/components/tasks/TaskForm.tsx` | #9, #10, #11 |
| `src/components/tasks/TaskItem.tsx` | #10 |
| `src/components/ui/Dialog.tsx` | #9 |
| `src/electron-main/services/sticky.service.ts` | #6 |
| `src/electron-main/services/recurrence.service.ts` | #11 |
| `src/shared/types/task.ts` | #11 |
| `src/shared/types/database.ts` | #11 |
| `src/components/tasks/StatsView.tsx` | #10 |
| `src/store/useTaskStore.ts` | #3 |

### 替换/删除
| 文件 | 操作 |
|------|------|
| `build-resources/icon.ico` | 替换 |
| `src/components/tasks/PomodoroTimer.tsx` | 被 PomodoroWorkbench 取代 |

---

## 实施顺序建议

```
Phase 1: 数据库 + 类型定义
  ├── #7  迁移 v2: 分类中文化
  ├── #11 迁移 v3: recurrence_days 字段
  └── #11 类型定义更新

Phase 2: 核心交互调整
  ├── #2  聚焦模式今日优先
  ├── #3  跨天对话框 + 今日默认
  ├── #8  分类上下文继承
  └── #10 移除任务表单中番茄钟字段

Phase 3: 番茄钟重构
  ├── #10 usePomodoroStore
  ├── #10 PomodoroWorkbench
  └── #12 PomodoroFloating 浮窗

Phase 4: UI 整合调整
  ├── #4  任务列表迷你日视图
  ├── #5  移除日历 Tab + 集成迷你月历
  ├── #6  便签右键菜单
  ├── #9  新建任务弹窗响应式
  └── #11 重复规则 UI 改为每周几天选择

Phase 5: 收尾
  ├── #1  图标替换（资源文件）
  └── 全面测试 + 验证
```

---

## 技术风险与注意事项

1. **番茄钟重构风险最高**（#10, #12）：涉及状态管理迁移、组件替换，需确保计时器在 store 中正确运行（setInterval 在 Zustand 外部管理，store 只存状态 + ref）。
2. **数据库迁移向后兼容**：v2/v3 迁移需处理已有用户数据的平滑升级。
3. **便签右键菜单**（#6）：需要区分便签窗口和主窗口的 IPC 事件，避免互相干扰。
4. **`estimated_pomodoro` 字段保留但不使用**：不复用数据库列，避免破坏已有数据。
