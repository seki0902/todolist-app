import React, { useEffect, useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { TaskStatus, Priority } from '../../shared/types/database';
import { Check, GripHorizontal, Focus, ListTodo, Play, ArrowLeft, Info, X, ChevronDown, Sun, Moon } from 'lucide-react';

const OPACITY_PRESETS = [60, 70, 80, 90, 100] as const;
const OPACITY_LABELS: Record<number, string> = { 60: '淡', 70: '适中', 80: '默认', 90: '清晰', 100: '不透明' };

export const StickyNote: React.FC = () => {
  const { tasks, loadTasks, updateTask } = useTaskStore();
  const [opacity, setOpacity] = useState(0.80);
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('sticky-guide-dismissed') !== 'true';
  });
  const [opacityOpen, setOpacityOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('sticky-color-mode') !== 'light';
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

  // Close opacity dropdown on outside click
  useEffect(() => {
    if (!opacityOpen) return;
    const handler = () => setOpacityOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [opacityOpen]);

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
    setOpacityOpen(false);
    localStorage.setItem('sticky-opacity', String(newOpacity));
    try {
      await (window as any).api?.sticky?.setOpacity?.(newOpacity);
    } catch {}
  };

  const handleToggleColor = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('sticky-color-mode', next ? 'dark' : 'light');
  };

  const focusMainWindow = () => {
    try {
      (window as any).api?.sticky?.focusMain?.();
    } catch {}
  };

  // Color mode styles
  const isDark = darkMode;
  const bgBase = isDark ? '18, 18, 24' : '248, 248, 252';
  const textPrimary = isDark ? 'text-white/90' : 'text-gray-800';
  const textSecondary = isDark ? 'text-white/70' : 'text-gray-600';
  const textMuted = isDark ? 'text-white/40' : 'text-gray-400';
  const textDim = isDark ? 'text-white/30' : 'text-gray-300';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200/60';
  const buttonHover = isDark ? 'hover:bg-white/15' : 'hover:bg-gray-300/60';
  const activeBg = isDark ? 'bg-white/20' : 'bg-gray-300';
  const cardBg = isDark ? 'bg-white/5' : 'bg-gray-100';
  const dropdownBg = isDark ? 'bg-zinc-800 border-white/10' : 'bg-white border-gray-200 shadow-lg';
  const dropdownItemHover = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100';

  const TaskRow = ({ task }: { task: typeof activeTasks[0] }) => (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${hoverBg}`}
      onClick={focusMainWindow}
      title="点击打开主窗口"
    >
      <button
        onClick={(e) => { e.stopPropagation(); handleDone(task.id); }}
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
          isDark ? 'border-white/30 hover:border-emerald-400 hover:bg-emerald-400/20' : 'border-gray-300 hover:border-emerald-500 hover:bg-emerald-100'
        }`}
      >
        <Check className="h-2.5 w-2.5 text-transparent group-hover:text-emerald-400" />
      </button>
      <span
        className={`text-xs truncate flex-1 ${
          task.priority === Priority.P1
            ? 'text-red-400'
            : task.priority === Priority.P2
              ? isDark ? 'text-orange-300' : 'text-orange-600'
              : textSecondary
        }`}
      >
        {task.title}
      </span>
      <span className={`text-[10px] flex-shrink-0 ${textDim}`}>
        P{task.priority}
      </span>
    </div>
  );

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none flex flex-col"
      style={{
        background: `rgba(${bgBase}, ${opacity})`,
        backdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* Drag handle header */}
      <div
        className={`flex items-center gap-2 px-4 py-3 border-b ${borderColor} flex-shrink-0`}
        style={{ WebkitAppRegion: 'drag' as any }}
      >
        <GripHorizontal className={`h-4 w-4 ${textMuted}`} />
        <span className={`text-sm font-semibold ${textPrimary}`}>FocusFlow 便签</span>
        <div className="flex-1" />

        {/* Color mode toggle */}
        <button
          onClick={handleToggleColor}
          className={`rounded-lg p-1.5 text-xs transition-colors ${textSecondary} ${buttonHover}`}
          style={{ WebkitAppRegion: 'no-drag' as any }}
          title={isDark ? '切换浅色' : '切换深色'}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        {/* Opacity dropdown */}
        <div className="relative" style={{ WebkitAppRegion: 'no-drag' as any }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpacityOpen(!opacityOpen); }}
            className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs transition-colors ${textSecondary} ${buttonHover}`}
          >
            不透明度
            <ChevronDown className={`h-3 w-3 transition-transform ${opacityOpen ? 'rotate-180' : ''}`} />
          </button>
          {opacityOpen && (
            <div className={`absolute top-full right-0 mt-1 rounded-lg border ${dropdownBg} py-1 min-w-[100px] z-50`}>
              {OPACITY_PRESETS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleOpacity(pct / 100)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    Math.round(opacity * 100) === pct
                      ? `${isDark ? 'text-white font-medium' : 'text-gray-900 font-medium'} ${activeBg}`
                      : `${textSecondary} ${dropdownItemHover}`
                  }`}
                >
                  <span>{pct}%</span>
                  <span className={`ml-2 ${textMuted}`}>{OPACITY_LABELS[pct]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Return to main window */}
        <button
          onClick={() => {
            try { (window as any).api?.sticky?.focusMain?.(); } catch {}
            try { (window as any).api?.sticky?.close?.(); } catch {}
          }}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors ${textSecondary} ${buttonHover}`}
          style={{ WebkitAppRegion: 'no-drag' as any }}
          title="关闭便签并返回主窗口"
        >
          <ArrowLeft className="h-3 w-3" />
          返回
        </button>
      </div>

      {/* Guidance banner for new users */}
      {showGuide && (
        <div
          className={`mx-3 mt-3 rounded-xl border ${borderColor} ${cardBg} p-3 flex items-start gap-2`}
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={`text-[11px] font-medium ${textSecondary}`}>💡 便签模式指南</p>
            <p className={`text-[10px] mt-0.5 leading-relaxed ${textMuted}`}>
              点击任务可快速切换至主窗口 · 勾选圆圈完成任务 · 顶部调整透明度 · 按需固定悬浮
            </p>
          </div>
          <button
            onClick={() => {
              setShowGuide(false);
              localStorage.setItem('sticky-guide-dismissed', 'true');
            }}
            className={`flex-shrink-0 rounded-full p-0.5 transition-colors ${textDim} ${isDark ? 'hover:text-white/70 hover:bg-white/10' : 'hover:text-gray-600 hover:bg-gray-200'}`}
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
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-3">📌</span>
            <span className={`text-xs ${textDim}`}>一切就绪</span>
            <span className={`text-[10px] mt-1 ${textDim}`}>在主窗口中创建任务</span>
          </div>
        ) : (
          <>
            {/* 进行中 section */}
            {inProgressTasks.length > 0 && (
              <Section icon={<Play className="h-3 w-3 text-blue-400" />} title="进行中" count={inProgressTasks.length} titleStyle={textSecondary} countStyle={textDim}>
                {inProgressTasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}

            {/* P1 section */}
            {p1Tasks.length > 0 && (
              <Section icon={<Focus className="h-3 w-3 text-red-400" />} title="P1 紧急" count={p1Tasks.length} titleStyle={textSecondary} countStyle={textDim}>
                {p1Tasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}

            {/* Today section */}
            {todayTasks.length > 0 && (
              <Section icon={<ListTodo className="h-3 w-3 text-emerald-400" />} title="今日任务" count={todayTasks.length} titleStyle={textSecondary} countStyle={textDim}>
                {todayTasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Section>
            )}

            {/* Fallback: show all active tasks if no sections */}
            {inProgressTasks.length === 0 && p1Tasks.length === 0 && todayTasks.length === 0 && (
              <Section icon={<ListTodo className={`h-3 w-3 ${textDim}`} />} title="待办" count={activeTasks.length} titleStyle={textSecondary} countStyle={textDim}>
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
  titleStyle,
  countStyle,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
  titleStyle: string;
  countStyle: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        {icon}
        <span className={`text-[11px] font-medium ${titleStyle}`}>{title}</span>
        <span className={`text-[10px] ml-auto ${countStyle}`}>{count}</span>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
