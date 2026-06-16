# FocusFlow — 日历模块轻量化重设计

**日期:** 2026-06-16
**状态:** 已批准

---

## 背景

当前日历模块使用 FullCalendar，存在三个问题：
1. **太重** — `@fullcalendar/*` 4 个包 ~200KB，而实际只用了月视图展示
2. **太丑** — FullCalendar 默认样式与 FocusFlow 的 glassmorphism 风格不协调
3. **无交互** — 只是静态展示，不能驱散任务筛选

用户的核心需求：**偶尔扫一眼这个月有什么任务**，不需要完整日历系统。

---

## 方案：侧边栏迷你月视图（方案 B）

### 改动清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 🗑️ 删除 | `src/components/tasks/CalendarView.tsx` | FullCalendar 包装组件 |
| 🗑️ 删除 | `src/components/tasks/TaskList.tsx` 内 `MiniMonthPicker` 组件（~70行） | 弹出日历筛选器，被 MiniCalendar 替代 |
| 🗑️ 移除 | `AppLayout.tsx` 中 `View` union 的 `'calendar'` 成员 + 侧边栏"日历"按钮 + `Ctrl+4` 快捷键 | 日历不再是独立视图 |
| 🗑️ 移除 | `package.json` 中 `@fullcalendar/core` `@fullcalendar/daygrid` `@fullcalendar/timegrid` `@fullcalendar/react` | ~200KB 依赖 |
| ✨ 新建 | `src/components/sidebar/MiniCalendar.tsx` | 侧边栏迷你月视图组件 |
| 🔧 修改 | `src/AppLayout.tsx` | 提升 `selectedDate` state，嵌入 MiniCalendar，传给 TaskList |
| 🔧 修改 | `src/components/tasks/TaskList.tsx` | `selectedDate` 改为 props，删 MiniMonthPicker；日期筛选从服务端改为客户端 |

### 架构

```
AppLayout
├── selectedDate: string | null (提升到此处)
│
├── 左侧边栏
│   ├── View switcher (focus / tasks / stats — 移除 calendar)
│   ├── CategorySidebar (现有)
│   ├── MiniCalendar (新增) ← 设置 selectedDate
│   └── PomodoroFloating (现有)
│
├── 主区域
│   └── TaskList ← 接收 selectedDate prop，客户端过滤（displayTasks useMemo）
│
└── TaskForm (现有) ← 日历日期点击 prefill 行为保持
```

### 数据流

```
useTaskStore.tasks (始终保持全量，不被日期筛选污染)
  → MiniCalendar: filter(t => t.due_time 在本月), groupBy date → 圆点计数 + 颜色
  → TaskList.displayTasks: selectedDate 改变时客户端过滤，无需 DB 往返

用户点击 MiniCalendar 日期 → setSelectedDate(dateStr) → displayTasks 客户端过滤当天
用户点击 "今天"           → setSelectedDate(null)    → displayTasks 显示全部
```

**关键决策：客户端筛选而非服务端。** 现有代码用 `loadTasks({ due_date })` 做服务端日期筛选，会替换 store 中的全量 tasks 为单日数据，导致 MiniCalendar 其他日期的圆点消失。改为在 `displayTasks` useMemo 中加 `selectedDate` 过滤，store.tasks 始终完整。

---

## MiniCalendar 组件设计

### Props

```typescript
interface MiniCalendarProps {
  tasks: TaskRow[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onDateDoubleClick: (date: Date) => void;
}
```

- `onSelectDate` — 单击日期，筛选任务列表
- `onDateDoubleClick` — 双击日期，打开新建任务表单并 prefill 截止日期

### 视觉结构

- CSS Grid 7×6，自适应侧边栏宽度（~220px）
- 月份头部：`‹ 2026年6月 ›` + "今天"快捷按钮
- 今天高亮：紫色半透明圆底
- 选中日期：紫色边框圆底
- 日期格子下方：最多 3 个优先级颜色圆点（红/橙/蓝/灰），超过 3 个显示 `+N`
- 日期格子 hover 时显示微弱 `+` 图标，提示可双击创建任务
- 样式匹配现有 glassmorphism 主题（`bg-card/90`, `backdrop-blur`, `border-white/10`）

### 圆点逻辑

```typescript
function getDotsForDate(tasks: TaskRow[], dateStr: string): Priority[] {
  const dayTasks = tasks.filter(t => {
    if (!t.due_time) return false;
    return new Date(t.due_time).toISOString().slice(0, 10) === dateStr;
  });
  // 返回优先级列表，去重，最多 3 个
  const priorities = [...new Set(dayTasks.map(t => t.priority))];
  return priorities.slice(0, 3);
}
```

### 边界情况

- 无任务的月份：格子为空，无圆点
- 跨月日期（上月末/下月初）：灰色显示，仍可点击
- 加载中状态：侧边栏宽度不变，格子显示骨架占位
- 任务很多的一天：圆点最多 3 个 + `+N` 标签

---

## AppLayout 改动

### 新增 state

```typescript
const [selectedDate, setSelectedDate] = useState<string | null>(null);
```

### 新增 MiniCalendar 嵌入

在 CategorySidebar 和 PomodoroFloating 之间插入：

```tsx
<MiniCalendar
  tasks={tasks}
  selectedDate={selectedDate}
  onSelectDate={(d) => setSelectedDate(d)}
  onDateDoubleClick={(date) => {
    setEditingTask(null);
    setPrefillDate(date);
    setFormOpen(true);
  }}
/>
```

### 传给 TaskList

```tsx
<TaskList
  categoryId={selectedCategory}
  dragOverId={dragOverId}
  selectedDate={selectedDate}
/>
```

### 删除

- `View` 类型：`'focus' | 'tasks' | 'stats' | 'calendar'` → `'focus' | 'tasks' | 'stats'`
- 侧边栏"日历"按钮
- `Ctrl+4` 快捷键
- `CalendarView` 渲染分支（`currentView === 'calendar' ? <CalendarView ... /> : ...`）

---

## TaskList 改动

### Props 变化

```typescript
// Before
interface TaskListProps {
  categoryId: string | null;
  dragOverId: string | null;
}

// After
interface TaskListProps {
  categoryId: string | null;
  dragOverId: string | null;
  selectedDate: string | null;
}
```

### 内部 state 删除

- 删除 `const [selectedDate, setSelectedDate] = useState<string | null>(null);`
- 用 props 中的 `selectedDate` 替换所有引用
- 删除 `useEffect` 中 `loadTasks({ due_date: selectedDate })` 调用 —— 日期筛选改为客户端

### `displayTasks` 加客户端日期过滤

在 `displayTasks` useMemo 中已有的客户端过滤链末尾，添加日期过滤：

```typescript
// 日期筛选（客户端，不触发 DB 查询）
if (selectedDate) {
  result = result.filter((t) => {
    if (!t.due_time) return false;
    return new Date(t.due_time).toISOString().slice(0, 10) === selectedDate;
  });
}
```

依赖数组中加入 `selectedDate`。

### MiniMonthPicker 删除

- 删除 `MiniMonthPicker` 组件定义（~70 行）
- 删除工具栏中的 MiniMonthPicker JSX
- 删除 `miniCalOpen` state
- 删除 `Calendar` 图标按钮

---

## 体积影响

| 项目 | Before | After |
|------|--------|-------|
| FullCalendar 依赖 | ~200KB | 0 |
| CalendarView.tsx | 64 行 | 0 |
| MiniMonthPicker (内联) | ~70 行 | 0 |
| MiniCalendar.tsx | 0 | ~120 行 |
| **净代码变化** | — | **−14 行** |
| **净依赖变化** | — | **−200KB** |

---

## 风险与回滚

- **风险低** — 日历模块独立，不影响任务 CRUD、番茄钟、统计
- 如果用户需要完整日历功能，可后续恢复 FullCalendar 作为可选视图
- 回滚：`git revert` 单 commit 即可
