import React, { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, Monitor, Settings } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { TitleBar } from './TitleBar';
import { ManageDialog } from '../tasks/ManageDialog';
import { DailyMigrationDialog } from '../tasks/DailyMigrationDialog';
import { TaskForm } from '../tasks/TaskForm';
import { useTaskStore } from '../../store/useTaskStore';
import { useCategoryStore } from '../../store/useCategoryStore';
import { useTagStore } from '../../store/useTagStore';
import { useTheme } from '../../hooks/useTheme';
import { CategorySidebar } from '../sidebar/CategorySidebar';
import { TaskList } from '../tasks/TaskList';
import { PomodoroWorkbench } from '../tasks/PomodoroWorkbench';
import { PomodoroFloating } from '../tasks/PomodoroFloating';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { StatsView } from '../tasks/StatsView';
import { FocusCardSkeleton, StatCardSkeleton } from '../ui/Skeleton';
import type { TaskRow, CreateTaskInput } from '../../shared/types/database';
import { getPriorityLabel } from '../../shared/types/database';

type View = 'focus' | 'tasks' | 'stats';

export const AppLayout: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('focus');
  const [manageOpen, setManageOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [yesterdayTasks, setYesterdayTasks] = useState<TaskRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);
  const { loadTasks, tasks, updateTask, createTask, initSync: initTaskSync, migrateTasksToToday } = useTaskStore();
  const { categories, loadCategories, initSync: initCategorySync } = useCategoryStore();
  const { initSync: initTagSync } = useTagStore();
  const { theme, setTheme } = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDragOverId(null);
    if (!over || active.id === over.id) return;

    // Check if dropped on a category (category droppable IDs are prefixed with 'cat:')
    if (typeof over.id === 'string' && over.id.startsWith('cat:')) {
      const catId = over.id.slice(4);
      updateTask(active.id as string, { category_id: catId || null });
      return;
    }
    // Check if dropped on the "全部任务" area to clear category
    if (over.id === 'cat:none') {
      updateTask(active.id as string, { category_id: null });
      return;
    }

    // Otherwise, it's task-to-task interaction (reparenting/reordering)
    const activeTask = tasks.find((t) => t.id === active.id);
    const overTask = tasks.find((t) => t.id === over.id);
    if (!activeTask || !overTask) return;

    if (activeTask.parent_id !== overTask.id) {
      updateTask(activeTask.id as string, { parent_id: overTask.id, sort: 0 });
    } else {
      updateTask(activeTask.id as string, { sort: overTask.sort + 1 });
    }
  }, [tasks, updateTask]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setDragOverId(over ? (over.id as string) : null);
  }, []);

  useEffect(() => {
    const init = async () => {
      await loadTasks();
      loadCategories();
      initTaskSync();
      initCategorySync();
      initTagSync();

      // Cross-day migration check — runs after tasks are loaded
      const today = new Date().toDateString();
      const lastActiveDate = localStorage.getItem('focusflow-last-active-date');
      if (lastActiveDate && lastActiveDate !== today) {
        const yesterdayStart = new Date();
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const state = useTaskStore.getState();
        // Catch all unfinished tasks: due yesterday OR updated yesterday (catches no-due-date tasks)
        const unfinished = state.tasks.filter(
          (t) =>
            t.progress < 100 &&
            t.status !== 'cancelled' &&
            (
              (t.due_time && t.due_time >= yesterdayStart.getTime() && t.due_time <= yesterdayEnd.getTime()) ||
              (t.updated_at >= yesterdayStart.getTime() && t.updated_at <= yesterdayEnd.getTime())
            )
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setEditingTask(null); setPrefillDate(null); setFormOpen(true); }
        if (e.key === '1') { e.preventDefault(); setCurrentView('focus'); }
        if (e.key === '2') { e.preventDefault(); setCurrentView('tasks'); }
        if (e.key === '3') { e.preventDefault(); setCurrentView('stats'); }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="搜索"]')?.focus(); }
      }
      if (e.key === 'Escape') {
        if (formOpen) { setFormOpen(false); setEditingTask(null); }
        if (manageOpen) { setManageOpen(false); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [formOpen, manageOpen]);

  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    setTheme(next[theme]);
  };

  const themeIcon = theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex h-screen overflow-hidden bg-background flex-col">
        {/* Custom Title Bar */}
        <TitleBar />

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="flex flex-col glass-sidebar overflow-y-auto">
            {/* View switcher */}
            <div className="flex flex-col gap-1 p-3 border-b border-white/10 dark:border-white/5">
              <button
                onClick={() => setCurrentView('focus')}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentView === 'focus'
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <span className="text-base">🎯</span>
                聚焦模式
              </button>
              <button
                onClick={() => setCurrentView('tasks')}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentView === 'tasks'
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <span className="text-base">📋</span>
                全部任务
              </button>
              <button
                onClick={() => setCurrentView('stats')}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentView === 'stats'
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <span className="text-base">📊</span>
                统计
              </button>
              <button
                onClick={() => usePomodoroStore.getState().open()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                <span className="text-base">🍅</span>
                番茄钟
              </button>
              <button
                onClick={() => setManageOpen(true)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                <span className="text-base">📋</span>
                模板
              </button>
            </div>

            <CategorySidebar
              selectedId={selectedCategory}
              dragOverId={dragOverId}
              onSelect={(id) => {
                setSelectedCategory(id);
                setCurrentView('tasks');
              }}
            />

            {/* Minimized pomodoro timer docks here */}
            <PomodoroFloating />

            {/* Bottom actions */}
            <div className="mt-auto p-3 border-t border-white/10 dark:border-white/5 flex items-center gap-1">
              <button
                onClick={cycleTheme}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors flex-1"
                title={`${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`}
              >
                {themeIcon}
                {theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '自动'}
              </button>
              <button
                onClick={() => setManageOpen(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                管理
              </button>
            </div>
          </div>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background/30 relative">
          {currentView === 'focus' ? (
            <FocusView />
          ) : currentView === 'stats' ? (
            <StatsView tasks={tasks} />
          ) : (
            <TaskList
              categoryId={selectedCategory}
              dragOverId={dragOverId}
            />
          )}
        </main>

        {/* Task Form — used by calendar date click + Ctrl+N shortcut */}
        <TaskForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingTask(null); setPrefillDate(null); }}
          onSave={async (data) => {
            if ('id' in data) {
              await updateTask(data.id, data.input);
            } else {
              // Inject prefill date from calendar click
              const input = { ...data, due_time: data.due_time ?? prefillDate?.getTime() };
              await createTask(input);
            }
            setFormOpen(false);
            setEditingTask(null);
            setPrefillDate(null);
          }}
          task={editingTask}
          categories={categories}
        />

        <ManageDialog open={manageOpen} onClose={() => setManageOpen(false)} />
        <PomodoroWorkbench />
        <DailyMigrationDialog
          open={migrationOpen}
          yesterdayTasks={yesterdayTasks}
          onSkip={() => {
            setMigrationOpen(false);
            localStorage.setItem('focusflow-last-active-date', new Date().toDateString());
          }}
          onMigrate={async (taskIds) => {
            setMigrationOpen(false);
            await migrateTasksToToday(taskIds);
            localStorage.setItem('focusflow-last-active-date', new Date().toDateString());
          }}
        />
        </div>
      </div>
    </DndContext>
  );
};

// Inline FocusView with glassmorphism + skeleton + parallax
const FocusView: React.FC = () => {
  const { tasks, loading } = useTaskStore();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const container = document.getElementById('focus-scroll');
    const handler = () => {
      if (container) setScrollY(container.scrollTop);
    };
    container?.addEventListener('scroll', handler, { passive: true });
    return () => container?.removeEventListener('scroll', handler);
  }, []);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayTasks = tasks.filter(
    (t) => t.due_time && t.due_time >= todayStart.getTime() && t.due_time <= todayEnd.getTime() && t.progress < 100 && t.status !== 'cancelled'
  );
  const inProgressTasks = tasks.filter((t) => t.progress > 0 && t.progress < 100 && t.status !== 'cancelled');
  const urgentTasks = tasks.filter((t) => t.priority === 1 && t.progress < 100 && t.status !== 'cancelled');
  const nextUpTasks = tasks.filter((t) => t.progress === 0 && t.status !== 'cancelled' && t.priority <= 2).slice(0, 5);
  // Today-first priority: today urgent → today any → urgent → in_progress
  const todayUrgent = todayTasks.filter(t => t.priority === 1);
  const focusTask = todayUrgent[0] || todayTasks[0] || urgentTasks[0] || inProgressTasks[0];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6) return '🌙 夜深了';
    if (h < 12) return '👋 早上好';
    if (h < 18) return '☀️ 下午好';
    return '🌆 晚上好';
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-y-auto" id="focus-scroll">
        <div className="px-8 py-6 space-y-2">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
        <FocusCardSkeleton />
        <div className="mx-8 mb-6 grid grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" id="focus-scroll">
      {/* Hero area with parallax */}
      <div
        className="px-8 py-8 transition-transform duration-500 ease-out"
        style={{ transform: `translateY(${-scrollY * 0.15}px)`, opacity: Math.max(1 - scrollY * 0.002, 0.4) }}
      >
        <h1 className="text-3xl font-bold text-foreground animate-fade-in-up">
          {getGreeting()}
        </h1>
        <p className="mt-2 text-muted-foreground animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          {focusTask ? '这是你当前最应该关注的任务 ✨' : '今天还没有任务，开始吧！'}
        </p>
      </div>

      {/* Focus Task Card - glass + glow */}
      {focusTask && (
        <div
          className="mx-8 mb-6 rounded-2xl p-6 animate-scale-in glass-strong hover-glow"
          style={{ transform: `translateY(${-scrollY * 0.05}px)` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1">
              🎯 当前聚焦
            </span>
            <span className={`text-xs font-bold ${
              focusTask.priority === 1 ? 'text-red-500' : focusTask.priority === 2 ? 'text-orange-500' : 'text-blue-500'
            }`}>
              {getPriorityLabel(focusTask.priority)}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{focusTask.title}</h2>
          {focusTask.description && (
            <p className="text-sm text-muted-foreground mb-4">{focusTask.description}</p>
          )}
          {/* Draggable progress in focus */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>完成进度</span>
              <span className="font-mono">{focusTask.progress}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-secondary/50 cursor-pointer relative overflow-hidden"
              onMouseDown={(e) => {
                const bar = e.currentTarget;
                const updateFromMouse = (ev: MouseEvent) => {
                  const rect = bar.getBoundingClientRect();
                  const x = ev.clientX - rect.left;
                  const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
                  const newStatus = pct === 100 ? 'done' : pct > 0 ? 'in_progress' : 'todo';
                  useTaskStore.getState().updateTask(focusTask.id, { progress: pct, status: newStatus });
                };
                updateFromMouse(e as any);
                const cleanup = () => { document.removeEventListener('mousemove', updateFromMouse); document.removeEventListener('mouseup', cleanup); };
                document.addEventListener('mousemove', updateFromMouse);
                document.addEventListener('mouseup', cleanup);
              }}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-purple-400 transition-all duration-200"
                style={{ width: `${focusTask.progress}%` }}
              />
            </div>
          </div>
          {focusTask.estimated_pomodoro > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
              <span>🍅 {focusTask.estimated_pomodoro} 个番茄钟</span>
              {focusTask.due_time && (
                <span>
                  ⏰ {new Date(focusTask.due_time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => {
              const store = usePomodoroStore.getState();
              store.selectTask(focusTask.id, focusTask.title);
              store.open();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 btn-lift shadow-lg shadow-primary/20"
            style={{ animation: 'pulse-glow 2s infinite' }}
          >
            🍅 开始番茄钟
          </button>
        </div>
      )}

      {/* Quick Stats - glass cards */}
      <div className="mx-8 mb-6 grid grid-cols-3 gap-4">
        {[
          { label: '今日任务', value: todayTasks.length, color: 'text-foreground' },
          { label: '进行中', value: inProgressTasks.length, color: 'text-blue-500' },
          { label: '紧急', value: urgentTasks.length, color: 'text-red-500' },
        ].map((s, i) => (
          <div key={s.label} className="glass-card rounded-2xl p-4" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`text-3xl font-bold ${s.color} tabular-nums`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <div className="mx-8 mb-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>📅</span> 今日任务
          </h3>
          <div className="flex flex-col gap-2 stagger">
            {todayTasks.map((task) => (
              <div key={task.id} className="glass-card flex items-center gap-3 p-3">
                <span className={`text-xs font-bold flex-shrink-0 ${
                  task.priority === 1 ? 'text-red-500' : task.priority === 2 ? 'text-orange-500' : 'text-blue-500'
                }`}>{getPriorityLabel(task.priority)}</span>
                <span className="text-sm text-foreground flex-1 truncate">{task.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(task.due_time!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Up */}
      {nextUpTasks.length > 0 && (
        <div className="mx-8 mb-8 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>👇</span> 下一步推荐
          </h3>
          <div className="flex flex-col gap-2 stagger">
            {nextUpTasks.map((task) => (
              <div key={task.id} className="glass-card flex items-center gap-3 p-3 opacity-80 hover:opacity-100">
                <span className={`text-xs font-bold ${
                  task.priority === 1 ? 'text-red-500' : task.priority === 2 ? 'text-orange-500' : 'text-gray-400'
                }`}>{getPriorityLabel(task.priority)}</span>
                <span className="text-sm text-foreground flex-1 truncate">{task.title}</span>
                <span className="text-xs text-muted-foreground">待开始</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!focusTask && (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground animate-fade-in">
          <span className="text-6xl mb-4">🎯</span>
          <p className="text-lg font-medium">一切就绪</p>
          <p className="text-sm mt-1">切换到"全部任务"开始规划你的工作</p>
        </div>
      )}

    </div>
  );
};
