import React, { useEffect, useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { TaskStatus, Priority } from '../../shared/types/database';
import { Check, GripHorizontal, Focus, ListTodo, Play, ArrowLeft, Info, X } from 'lucide-react';

const OPACITY_PRESETS = [60, 70, 80, 90, 100] as const;

export const StickyNote: React.FC = () => {
  const { tasks, loadTasks, updateTask } = useTaskStore();
  const [opacity, setOpacity] = useState(0.80);
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('sticky-guide-dismissed') !== 'true';
  });

  useEffect(() => {
    loadTasks();
    // Load saved opacity (both CSS alpha + window native opacity)
    const saved = localStorage.getItem('sticky-opacity');
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val)) {
        setOpacity(val);
        try { (window as any).api?.sticky?.setOpacity?.(val); } catch {}
      }
    }
    // Make body transparent for sticky mode
    document.body.classList.add('sticky-mode');
    return () => {
      document.body.classList.remove('sticky-mode');
    };
  }, []);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const activeTasks = tasks.filter(
    (t) => t.status !== TaskStatus.CANCELLED && t.progress < 100
  );

  const todayTasks = activeTasks.filter(
    (t) => t.due_time && t.due_time >= todayStart.getTime() && t.due_time <= todayEnd.getTime()
  );
  const p1Tasks = activeTasks.filter((t) => t.priority === Priority.P1);
  const inProgressTasks = activeTasks.filter((t) => t.progress > 0 && t.progress < 100);

  const handleDone = async (id: string) => {
    await updateTask(id, { status: TaskStatus.DONE, progress: 100 });
  };

  const handleOpacity = async (newOpacity: number) => {
    setOpacity(newOpacity);
    localStorage.setItem('sticky-opacity', String(newOpacity));
    try {
      await (window as any).api?.sticky?.setOpacity?.(newOpacity);
    } catch {}
  };

  const focusMainWindow = () => {
    // Click task → focus the main app window
    try {
      (window as any).api?.sticky?.focusMain?.();
    } catch {}
  };

  const TaskRow = ({ task }: { task: typeof activeTasks[0] }) => (
    <div
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10 transition-colors cursor-pointer"
      onClick={focusMainWindow}
      title="点击打开主窗口"
    >
      <button
        onClick={(e) => { e.stopPropagation(); handleDone(task.id); }}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-white/30 hover:border-emerald-400 hover:bg-emerald-400/20 transition-colors"
      >
        <Check className="h-2.5 w-2.5 text-transparent group-hover:text-emerald-400" />
      </button>
      <span
        className={`text-xs truncate flex-1 ${
          task.priority === Priority.P1
            ? 'text-red-400'
            : task.priority === Priority.P2
              ? 'text-orange-300'
              : 'text-white/70'
        }`}
      >
        {task.title}
      </span>
      <span className="text-[10px] text-white/30 flex-shrink-0">
        P{task.priority}
      </span>
    </div>
  );

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none flex flex-col"
      style={{
        background: `rgba(18, 18, 24, ${opacity})`,
        backdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* Drag handle header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' as any }}
      >
        <GripHorizontal className="h-4 w-4 text-white/40" />
        <span className="text-sm font-semibold text-white/90">FocusFlow 便签</span>
        <div className="flex-1" />
        {/* Return to main window */}
        <button
          onClick={() => {
            try { (window as any).api?.sticky?.focusMain?.(); } catch {}
            try { (window as any).api?.sticky?.close?.(); } catch {}
          }}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' as any }}
          title="关闭便签并返回主窗口"
        >
          <ArrowLeft className="h-3 w-3" />
          返回
        </button>
        {/* Opacity presets */}
        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' as any }}>
          {OPACITY_PRESETS.map((pct) => (
            <button
              key={pct}
              onClick={() => handleOpacity(pct / 100)}
              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                Math.round(opacity * 100) === pct
                  ? 'bg-white/20 text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/10'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Guidance banner for new users */}
      {showGuide && (
        <div
          className="mx-3 mt-3 rounded-xl border border-white/10 bg-white/5 p-3 flex items-start gap-2"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[11px] font-medium text-white/80">💡 便签模式指南</p>
            <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
              点击任务可快速切换至主窗口 · 勾选圆圈完成任务 · 顶部调整透明度 · 按需固定悬浮
            </p>
          </div>
          <button
            onClick={() => {
              setShowGuide(false);
              localStorage.setItem('sticky-guide-dismissed', 'true');
            }}
            className="flex-shrink-0 rounded-full p-0.5 text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' as any }}
            title="不再显示"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Scrollable task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4" style={{ WebkitAppRegion: 'no-drag' as any }}>
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/30">
            <span className="text-4xl mb-3">📌</span>
            <span className="text-xs">一切就绪</span>
            <span className="text-[10px] mt-1">在主窗口中创建任务</span>
          </div>
        ) : (
          <>
            {/* 进行中 section */}
            {inProgressTasks.length > 0 && (
              <Section icon={<Play className="h-3 w-3 text-blue-400" />} title="进行中" count={inProgressTasks.length}>
                {inProgressTasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}

            {/* P1 section */}
            {p1Tasks.length > 0 && (
              <Section icon={<Focus className="h-3 w-3 text-red-400" />} title="P1 紧急" count={p1Tasks.length}>
                {p1Tasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}

            {/* Today section */}
            {todayTasks.length > 0 && (
              <Section icon={<ListTodo className="h-3 w-3 text-emerald-400" />} title="今日任务" count={todayTasks.length}>
                {todayTasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}

            {/* Fallback: show all active tasks if no sections */}
            {inProgressTasks.length === 0 && p1Tasks.length === 0 && todayTasks.length === 0 && (
              <Section icon={<ListTodo className="h-3 w-3 text-white/50" />} title="待办" count={activeTasks.length}>
                {activeTasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        {icon}
        <span className="text-[11px] font-medium text-white/60">{title}</span>
        <span className="text-[10px] text-white/30 ml-auto">{count}</span>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
