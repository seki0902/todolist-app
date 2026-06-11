import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pause, Play, X } from 'lucide-react';
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

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && isMinimized) {
      const saved = localStorage.getItem('focusflow-float-pos');
      if (saved) {
        try {
          const { x, y } = JSON.parse(saved);
          setPosition({ x, y });
        } catch {}
      } else {
        setPosition({
          x: window.innerWidth - 220,
          y: window.innerHeight - 80,
        });
      }
    }
  }, [isOpen, isMinimized]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      const handleMove = (ev: MouseEvent) => {
        const newX = Math.max(0, Math.min(ev.clientX - dragStart.current.x, window.innerWidth - 200));
        const newY = Math.max(0, Math.min(ev.clientY - dragStart.current.y, window.innerHeight - 60));
        setPosition({ x: newX, y: newY });
      };
      const handleUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        localStorage.setItem(
          'focusflow-float-pos',
          JSON.stringify(position)
        );
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [position]
  );

  if (!isOpen || !isMinimized) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div
      ref={floatRef}
      className="fixed z-[100] select-none"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-lg backdrop-blur-md border cursor-pointer transition-all ${
          dragging ? 'scale-105' : 'hover:scale-105'
        } ${
          isPaused
            ? 'bg-amber-500/90 border-amber-400/50'
            : 'bg-background/90 border-primary/30'
        }`}
        onMouseDown={handleMouseDown}
        onClick={() => expand()}
      >
        <span className="text-base">🍅</span>
        <span className="font-mono text-sm font-bold text-foreground tabular-nums">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        {selectedTaskTitle && (
          <span className="text-xs text-muted-foreground max-w-[80px] truncate">
            {selectedTaskTitle}
          </span>
        )}
        <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
          {isPaused ? (
            <button
              onClick={resume}
              className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/20"
              title="继续"
            >
              <Play className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={pause}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-accent/30"
              title="暂停"
            >
              <Pause className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            className="rounded-full p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="结束"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
