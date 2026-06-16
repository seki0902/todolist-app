# Calendar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FullCalendar with a sidebar mini calendar using CSS Grid, with client-side date filtering.

**Architecture:** Lift `selectedDate` state to `AppLayout`, pass to both `MiniCalendar` (in sidebar) and `TaskList` (in main area). Date filtering is client-side in `displayTasks` useMemo — store.tasks always holds full dataset so MiniCalendar dots never break.

**Tech Stack:** React, TypeScript, TailwindCSS, Zustand (unchanged)

---

### Task 1: Remove FullCalendar dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit package.json**

Remove these 4 dependencies from `devDependencies`:

```diff
-    "@fullcalendar/core": "^6.1.0",
-    "@fullcalendar/daygrid": "^6.1.0",
-    "@fullcalendar/react": "^6.1.0",
-    "@fullcalendar/timegrid": "^6.1.0",
```

- [ ] **Step 2: Clean install**

Run: `npm install`
Expected: No errors, `node_modules` prunes the removed packages.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove FullCalendar dependencies (~200KB)"
```

---

### Task 2: Delete CalendarView.tsx

**Files:**
- Delete: `src/components/tasks/CalendarView.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/tasks/CalendarView.tsx
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tasks/CalendarView.tsx
git commit -m "chore: remove CalendarView (replaced by MiniCalendar)"
```

---

### Task 3: Refactor TaskList — date filter from server-side to client-side

**Files:**
- Modify: `src/components/tasks/TaskList.tsx`

- [ ] **Step 1: Add `selectedDate` to props interface**

At line 18-21, replace the interface:

```typescript
interface TaskListProps {
  categoryId: string | null;
  dragOverId: string | null;
  selectedDate: string | null;
}
```

- [ ] **Step 2: Destructure `selectedDate` from props**

At line 88, replace:

```typescript
export const TaskList: React.FC<TaskListProps> = ({ categoryId, dragOverId }) => {
```

with:

```typescript
export const TaskList: React.FC<TaskListProps> = ({ categoryId, dragOverId, selectedDate }) => {
```

- [ ] **Step 3: Remove internal `selectedDate` and `miniCalOpen` state**

At lines 106-107, remove:

```typescript
  const [miniCalOpen, setMiniCalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
```

- [ ] **Step 4: Remove server-side date filter from useEffect**

At lines 113-116, replace:

```typescript
  // Reload tasks when tag or date filter changes
  useEffect(() => {
    loadTasks({ tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined, due_date: selectedDate ?? undefined });
  }, [selectedTagIds, selectedDate]);
```

with:

```typescript
  // Reload tasks when tag filter changes (date filter is client-side)
  useEffect(() => {
    loadTasks({ tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined });
  }, [selectedTagIds]);
```

- [ ] **Step 5: Add client-side date filter to `displayTasks` useMemo**

At line 155, before `return buildTree(result);`, insert:

```typescript
    // Date filter (client-side — does not pollute store.tasks, so MiniCalendar dots stay intact)
    if (selectedDate) {
      result = result.filter((t) => {
        if (!t.due_time) return false;
        return new Date(t.due_time).toISOString().slice(0, 10) === selectedDate;
      });
    }
```

- [ ] **Step 6: Update `displayTasks` dependency array**

At line 157, replace:

```typescript
  }, [tasks, categoryId, search, showCancelled]);
```

with:

```typescript
  }, [tasks, categoryId, search, showCancelled, selectedDate]);
```

- [ ] **Step 7: Remove MiniMonthPicker usage from toolbar**

At lines 316-346, replace:

```tsx
        <div className="flex items-center gap-2">
          {/* Mini month picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMiniCalOpen(!miniCalOpen)}
              title="选择日期筛选"
            >
              <Calendar className="h-4 w-4" />
              {selectedDate && (
                <span className="ml-1 text-xs text-primary">
                  {new Date(selectedDate).getDate()}日
                </span>
              )}
            </Button>
            {miniCalOpen && (
              <MiniMonthPicker
                selectedDate={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d);
                  setMiniCalOpen(false);
                  if (d) {
                    setSearch('');
                    loadTasks();
                  }
                }}
                onClose={() => setMiniCalOpen(false)}
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditingTask(null); setParentId(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4" /> 新建任务
          </Button>
        </div>
```

with:

```tsx
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditingTask(null); setParentId(null); setFormOpen(true); }}
          >
            <Plus className="h-4 w-4" /> 新建任务
          </Button>
        </div>
```

- [ ] **Step 8: Remove `Calendar` from lucide import**

At line 6, change:

```typescript
import { Plus, Search, ListTodo, Tag, X, Calendar } from 'lucide-react';
```

to:

```typescript
import { Plus, Search, ListTodo, Tag, X } from 'lucide-react';
```

- [ ] **Step 9: Delete MiniMonthPicker component definition**

Remove lines 490-573 (the entire `MiniMonthPicker` component, including `WEEKDAYS_ZH` constant).

- [ ] **Step 10: Commit**

```bash
git add src/components/tasks/TaskList.tsx
git commit -m "refactor: move date filter to client-side, remove MiniMonthPicker"
```

---

### Task 4: Create MiniCalendar component

**Files:**
- Create: `src/components/sidebar/MiniCalendar.tsx`

- [ ] **Step 1: Create the file**

Write `src/components/sidebar/MiniCalendar.tsx`:

```typescript
import React, { useMemo } from 'react';
import type { TaskRow } from '../../shared/types/database';
import { Priority } from '../../shared/types/database';

interface MiniCalendarProps {
  tasks: TaskRow[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  onDateDoubleClick: (date: Date) => void;
}

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日'];

function getDotsForDate(tasks: TaskRow[], dateStr: string): Priority[] {
  const priorities = tasks
    .filter((t) => {
      if (!t.due_time) return false;
      return new Date(t.due_time).toISOString().slice(0, 10) === dateStr;
    })
    .map((t) => t.priority);
  return [...new Set(priorities)].slice(0, 3);
}

const DOT_COLORS: Record<Priority, string> = {
  [Priority.P1]: 'bg-red-500',
  [Priority.P2]: 'bg-orange-500',
  [Priority.P3]: 'bg-blue-500',
  [Priority.P4]: 'bg-gray-400',
};

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  tasks,
  selectedDate,
  onSelectDate,
  onDateDoubleClick,
}) => {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth());

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  const days: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  // Pre-compute dot maps for all days this month (avoid repeated filter() on every render)
  const dotsMap = useMemo(() => {
    const map = new Map<string, Priority[]>();
    for (const task of tasks) {
      if (!task.due_time) continue;
      const d = new Date(task.due_time);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateStr = d.toISOString().slice(0, 10);
        if (!map.has(dateStr)) {
          map.set(dateStr, getDotsForDate(tasks, dateStr));
        }
      }
    }
    return map;
  }, [tasks, year, month]);

  const handleDateClick = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateStr === selectedDate) {
      onSelectDate(null);
    } else {
      onSelectDate(dateStr);
    }
  };

  const handleDateDoubleClick = (d: number) => {
    const date = new Date(year, month, d);
    date.setHours(23, 59, 0, 0);
    onDateDoubleClick(date);
  };

  return (
    <div className="px-3 py-3 border-t border-white/10 dark:border-white/5">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground text-xs"
        >
          ‹
        </button>
        <span className="text-xs font-medium text-foreground">
          {year}年{month + 1}月
        </span>
        <button
          onClick={() => month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground text-xs"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {WEEKDAYS_ZH.map((w) => (
          <span key={w} className="text-[10px] text-muted-foreground py-0.5">{w}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dots = dotsMap.get(dateStr) || [];

          return (
            <button
              key={d}
              onClick={() => handleDateClick(d)}
              onDoubleClick={() => handleDateDoubleClick(d)}
              className={`relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs transition-colors group ${
                isSelected
                  ? 'bg-primary/20 text-primary font-semibold ring-1 ring-primary/40'
                  : isToday
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-accent'
              }`}
            >
              {/* Hover "+" create hint */}
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-30 text-primary text-lg font-light transition-opacity pointer-events-none">
                +
              </span>
              {d}
              {/* Priority dots */}
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((p) => (
                    <span key={p} className={`w-1 h-1 rounded-full ${DOT_COLORS[p]}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <button
        onClick={() => {
          const t = new Date();
          setYear(t.getFullYear());
          setMonth(t.getMonth());
          onSelectDate(null);
        }}
        className="mt-2 w-full text-[11px] text-muted-foreground hover:text-foreground rounded py-0.5 transition-colors"
      >
        回到今天
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar/MiniCalendar.tsx
git commit -m "feat: add MiniCalendar sidebar widget (CSS Grid, ~120 lines)"
```

---

### Task 5: Modify AppLayout to wire MiniCalendar

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Add MiniCalendar import**

At line 20 (after CategorySidebar import), add:

```typescript
import { MiniCalendar } from '../sidebar/MiniCalendar';
```

- [ ] **Step 2: Remove CalendarView import**

At line 26, remove:

```typescript
import { CalendarView } from '../tasks/CalendarView';
```

- [ ] **Step 3: Change `View` type**

At line 31, replace:

```typescript
type View = 'focus' | 'tasks' | 'stats' | 'calendar';
```

with:

```typescript
type View = 'focus' | 'tasks' | 'stats';
```

- [ ] **Step 4: Add `selectedDate` state**

At line 34 (after `const [selectedCategory, ...]`), add:

```typescript
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
```

- [ ] **Step 5: Add MiniCalendar to sidebar**

After CategorySidebar closing tag (line 245, after `/>`) and before `{/* Minimized pomodoro timer docks here */}` (line 248), insert:

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

- [ ] **Step 6: Remove calendar button from view switcher**

Lines 218-228, remove:

```tsx
              <button
                onClick={() => setCurrentView('calendar')}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentView === 'calendar'
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <Calendar className="h-4 w-4" />
                日历
              </button>
```

- [ ] **Step 7: Remove `Ctrl+4` keyboard shortcut**

At line 139, remove:

```typescript
        if (e.key === '4') { e.preventDefault(); setCurrentView('calendar'); }
```

- [ ] **Step 8: Remove CalendarView rendering branch**

Lines 272-287, replace:

```tsx
          {currentView === 'calendar' ? (
            <CalendarView
              tasks={tasks}
              onDateClick={(date) => {
                setEditingTask(null);
                setPrefillDate(date);
                setFormOpen(true);
              }}
              onEventClick={(taskId) => {
                const task = tasks.find((t) => t.id === taskId);
                if (task) {
                  setEditingTask(task);
                  setFormOpen(true);
                }
              }}
            />
          ) : currentView === 'focus' ? (
```

with:

```tsx
          {currentView === 'focus' ? (
```

- [ ] **Step 9: Pass `selectedDate` to TaskList**

Lines 293-296, replace:

```tsx
            <TaskList
              categoryId={selectedCategory}
              dragOverId={dragOverId}
            />
```

with:

```tsx
            <TaskList
              categoryId={selectedCategory}
              dragOverId={dragOverId}
              selectedDate={selectedDate}
            />
```

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "feat: wire MiniCalendar into sidebar, remove calendar view"
```

---

### Task 6: Verify type-check and build

- [ ] **Step 1: Run type-check**

```bash
npm run type-check
```

Expected: Only pre-existing errors remain (FullCalendar-related, WebkitAppRegion, etc.). No new errors from our changes.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds. Bundle size decreased by ~200KB vs before (FullCalendar removed).

- [ ] **Step 3: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: type-check and build adjustments"
```

---

### Task 7: Final verification in dev mode

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual QA checklist**

| Check | Expected |
|-------|----------|
| App launches without crash | ✅ |
| Focus view shows no calendar clutter | ✅ |
| Sidebar shows MiniCalendar below categories | ✅ |
| MiniCalendar shows today highlighted | ✅ |
| Tasks with due dates show colored dots on correct dates | ✅ |
| Click a date → TaskList filters to that day's tasks | ✅ |
| Click selected date again → clears filter, shows all | ✅ |
| Click "回到今天" → navigates to current month, clears filter | ✅ |
| Double-click a date → TaskForm opens with that date pre-filled | ✅ |
| Ctrl+4 no longer triggers calendar view (should do nothing) | ✅ |
| Old CalendarView URL hash `/calendar` no longer exists | ✅ |
| Build size decreased | ✅ |

- [ ] **Step 3: Commit final adjustments**

```bash
git add -A
git commit -m "chore: final QA adjustments for calendar redesign"
```

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Files | 3 changed | 1 new, 2 modified, 1 deleted |
| Dependencies | 4 @fullcalendar packages | 0 |
| Bundle | +200KB FullCalendar | −200KB |
| Code | CalendarView 64 + MiniMonthPicker 70 = 134 lines | MiniCalendar 120 lines |
| Date filtering | Server round-trip (slow) | Client-side (instant) |
| Calendar visibility | Separate view (hidden most of time) | Always visible in sidebar |
