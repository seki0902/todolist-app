import React from 'react';
import { Play, Pause, X, Maximize2 } from 'lucide-react';
import { usePomodoroStore } from '../../store/usePomodoroStore';

export const PomodoroFloating: React.FC = () => {
  const {
    isRunning,
    isPaused,
    timeLeft,
    selectedTaskTitle,
    isOpen,
    isMinimized,
    expand,
    close,
    pause,
    resume,
  } = usePomodoroStore();

  if (!isOpen || !isMinimized) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = 1 - timeLeft / (usePomodoroStore.getState().totalDuration * 60);

  return (
    <div className="mt-auto mx-3 mb-3 rounded-xl border border-primary/30 bg-card/90 backdrop-blur-md p-3 shadow-lg shadow-primary/10">
      {/* Task name */}
      {selectedTaskTitle && (
        <p className="text-[11px] text-muted-foreground truncate mb-2 px-0.5">
          🍅 {selectedTaskTitle}
        </p>
      )}

      {/* Timer display */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-lg font-bold text-foreground tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="h-1.5 w-full rounded-full bg-secondary mb-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isPaused ? 'bg-amber-400' : 'bg-primary'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {isPaused ? (
          <button
            onClick={resume}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Play className="h-3 w-3" />
            继续
          </button>
        ) : (
          <button
            onClick={pause}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-secondary px-2 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Pause className="h-3 w-3" />
            暂停
          </button>
        )}
        <button
          onClick={expand}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="展开"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={close}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="结束"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
