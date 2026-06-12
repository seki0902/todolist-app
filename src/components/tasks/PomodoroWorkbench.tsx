import React, { useState, useMemo, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Search, Minimize2, Clock } from 'lucide-react';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { useTaskStore } from '../../store/useTaskStore';
import { TaskStatus, getPriorityLabel } from '../../shared/types/database';

const DURATIONS = [15, 25, 35, 45, 60];

export const PomodoroWorkbench: React.FC = () => {
  const {
    isOpen,
    isRunning,
    isPaused,
    timeLeft,
    totalDuration,
    selectedTaskId,
    selectedTaskTitle,
    isMinimized,
    history,
    close,
    selectTask,
    setDuration,
    start,
    pause,
    resume,
    reset,
    minimize,
  } = usePomodoroStore();

  const { tasks } = useTaskStore();
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.status !== TaskStatus.CANCELLED && t.progress < 100
      ),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return activeTasks.slice(0, 20);
    const term = search.toLowerCase();
    return activeTasks
      .filter((t) => t.title.toLowerCase().includes(term))
      .slice(0, 20);
  }, [activeTasks, search]);

  const progress = totalDuration > 0 ? 1 - timeLeft / (totalDuration * 60) : 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const circumference = 2 * Math.PI * 80;

  // Load history on mount
  useEffect(() => {
    usePomodoroStore.getState().loadHistory();
  }, []);

  if (!isOpen || isMinimized) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">🍅 番茄钟</h2>
          <div className="flex items-center gap-1">
            {isRunning && (
              <button
                onClick={minimize}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                title="缩小为浮窗"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => { reset(); close(); }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Task Selector */}
        <div className="mb-5 relative">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            📋 专注任务
          </label>
          <div className="relative">
            <div
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 cursor-pointer"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span
                className={`text-sm flex-1 truncate ${
                  selectedTaskTitle ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {selectedTaskTitle || '搜索并选择任务...'}
              </span>
            </div>
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                <div className="p-2 border-b border-border">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索..."
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                </div>
                {filteredTasks.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center">无匹配任务</p>
                ) : (
                  filteredTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        selectTask(t.id, t.title);
                        setDropdownOpen(false);
                        setSearch('');
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                        selectedTaskId === t.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                      }`}
                    >
                      <span className="truncate flex-1">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {getPriorityLabel(t.priority)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Timer Circle */}
        <div className="flex items-center justify-center mb-5">
          <div className="relative">
            <svg width="200" height="200" className="-rotate-90">
              <circle
                cx="100" cy="100" r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-secondary"
              />
              <circle
                cx="100" cy="100" r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round"
                className="text-primary transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-mono font-bold text-foreground tabular-nums">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
              {selectedTaskTitle && isRunning && (
                <span className="text-xs text-muted-foreground mt-1 max-w-[120px] truncate">
                  {selectedTaskTitle}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Duration selector */}
        {!isRunning && (
          <div className="flex justify-center gap-2 mb-5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  totalDuration === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {d}分钟
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3 mb-5">
          {!isRunning ? (
            <button
              onClick={start}
              disabled={!selectedTaskId}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" /> 开始专注
            </button>
          ) : isPaused ? (
            <>
              <button
                onClick={resume}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Play className="h-4 w-4" /> 继续
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> 结束
              </button>
            </>
          ) : (
            <>
              <button
                onClick={pause}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Pause className="h-4 w-4" /> 暂停
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> 结束
              </button>
            </>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> 历史
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {history
                .slice(-5)
                .reverse()
                .map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="truncate flex-1">{r.taskTitle}</span>
                    <span>{r.duration}分钟</span>
                    <span>
                      {new Date(r.completedAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
