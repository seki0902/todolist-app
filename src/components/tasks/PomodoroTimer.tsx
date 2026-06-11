import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';

const DURATIONS = [
  { label: '15分钟', value: 15 },
  { label: '25分钟', value: 25 },
  { label: '35分钟', value: 35 },
  { label: '45分钟', value: 45 },
  { label: '60分钟', value: 60 },
];

interface PomodoroTimerProps {
  taskId?: string;
  taskTitle?: string;
  open: boolean;
  onClose: () => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ taskId, taskTitle, open, onClose }) => {
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessions, setSessions] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('focusflow-pomodoro-sessions');
        const all: Record<string, number> = stored ? JSON.parse(stored) : {};
        return taskTitle ? (all[taskTitle] || 0) : 0;
      } catch { return 0; }
    }
    return 0;
  });
  const [totalSessions, setTotalSessions] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('focusflow-pomodoro-sessions');
        const all: Record<string, number> = stored ? JSON.parse(stored) : {};
        return Object.values(all).reduce((a, b) => a + b, 0);
      } catch { return 0; }
    }
    return 0;
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalSeconds = duration * 60;
  const progress = 1 - timeLeft / totalSeconds;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const persistSession = () => {
    const key = taskTitle || '__untitled__';
    const newSessionCount = sessions + 1;
    try {
      const stored = localStorage.getItem('focusflow-pomodoro-sessions');
      const all: Record<string, number> = stored ? JSON.parse(stored) : {};
      all[key] = newSessionCount;
      localStorage.setItem('focusflow-pomodoro-sessions', JSON.stringify(all));
      setSessions(newSessionCount);
      setTotalSessions(Object.values(all).reduce((a, b) => a + b, 0));
    } catch {}
    // Persist to task's ai_meta for cross-device sync
    if (taskId) {
      try {
        (window as any).api?.db?.updateTask?.(taskId, {
          ai_meta: JSON.stringify({ pomodoro_sessions: newSessionCount, last_session_at: Date.now() }),
        });
      } catch {}
    }
    // System notification
    try {
      (window as any).api?.notify?.pomodoroComplete?.(taskTitle);
    } catch {}
  };

  const tick = useCallback(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(intervalRef.current!);
        setIsRunning(false);
        persistSession();
        // Notification sound
        if (typeof window !== 'undefined') {
          new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+Af4CAgICAgICAgH9/f39/f39/f39/f4CAgICAgICAgH+AgH9/f39/f4B/f3+Af39/f39/gICAgICAgIB/f39/f39/gH9/f3+AgICAgICAgICAf39/f39/gH9/gICAgICAgICAgIB/f39/f4B/f3+AgICAgICAgICAf39/f39/f39/f39/f4B/f3+Af39/f39/f39/f39/f39/gH+Af4CAf39/f39/f39/f39/f4B/f3+Af4CAgICAgICAgICAf3+Af39/f39/f39/f4CAgICAgICAgIB/f3+Af39/f4B/gICAgICAgICAf39/f3+Af39/f39/gH+AgICAgICAgH9/f39/f39/gH9/f39/f39/f39/f3+AgICAf39/f3+Af39/f39/f3+Af4B/f39/f39/f3+AgICAf39/f39/gICAgICAgH9/gICAgICAgH+Af39/f39/f3+Af39/f39/f39/f39/f39/f39/f3+AgICAf39/f39/f39/f39/gICAgICAgH9/f3+AgICAgICAgICAf39/f3+AgICAgICAgICAf3+AgICAgICAgH9/f3+Af39/f39/f39/f39/f3+Af39/f39/f3+Af4B/f3+AgICAgICAgH9/f3+AgICAf39/f3+AgICAf39/f39/f4B/f39/f39/gICAgICAgH+Af39/gICAgICAgICAf3+AgICAf3+Af4B/f3+Af39/f39/f3+AgICAgICAgICAf3+Af39/f39/f3+Af4B/f39/f3+Af3+AgICAf39/f3+Af4B/gICAgICAgICA').play().catch(() => {});
        }
        return 0;
      }
      return prev - 1;
    });
  }, [taskTitle]);

  const start = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(true);
    setIsPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPaused(true);
  };

  const resume = () => {
    setIsPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(duration * 60);
  };

  const changeDuration = (d: number) => {
    if (isRunning) reset();
    setDuration(d);
    setTimeLeft(d * 60);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!open) return null;

  const circumference = 2 * Math.PI * 80;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <button
          onClick={() => { reset(); onClose(); }}
          className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-foreground mb-2">🍅 番茄钟</h2>
        {taskTitle && (
          <p className="text-sm text-muted-foreground mb-6 truncate">{taskTitle}</p>
        )}

        {/* Circular progress */}
        <div className="flex items-center justify-center mb-6">
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
              <span className="text-xs text-muted-foreground mt-1">
                本任务 {sessions} 次 · 总计 {totalSessions} 个番茄
              </span>
            </div>
          </div>
        </div>

        {/* Duration selector */}
        {!isRunning && (
          <div className="flex justify-center gap-2 mb-6">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => changeDuration(d.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  duration === d.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!isRunning ? (
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
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
      </div>
    </div>
  );
};
