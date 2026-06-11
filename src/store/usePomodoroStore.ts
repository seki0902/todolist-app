import { create } from 'zustand';

export interface PomodoroRecord {
  taskId: string | null;
  taskTitle: string;
  duration: number;
  completedAt: number;
}

interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  timeLeft: number;
  totalDuration: number;
  selectedTaskId: string | null;
  selectedTaskTitle: string | null;
  isMinimized: boolean;
  isOpen: boolean;
  history: PomodoroRecord[];
  intervalRef: ReturnType<typeof setInterval> | null;

  open: () => void;
  close: () => void;
  selectTask: (id: string | null, title: string | null) => void;
  setDuration: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  minimize: () => void;
  expand: () => void;
  tick: () => void;
  loadHistory: () => void;
}

function loadHistory(): PomodoroRecord[] {
  try {
    const raw = localStorage.getItem('focusflow-pomodoro-history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: PomodoroRecord[]): void {
  localStorage.setItem('focusflow-pomodoro-history', JSON.stringify(history.slice(-50)));
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  isRunning: false,
  isPaused: false,
  timeLeft: 25 * 60,
  totalDuration: 25,
  selectedTaskId: null,
  selectedTaskTitle: null,
  isMinimized: false,
  isOpen: false,
  history: loadHistory(),
  intervalRef: null,

  open: () => set({ isOpen: true, isMinimized: false }),

  close: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    set({ isOpen: false, isRunning: false, isPaused: false, isMinimized: false });
  },

  selectTask: (id, title) => set({ selectedTaskId: id, selectedTaskTitle: title }),

  setDuration: (minutes) => {
    const { isRunning } = get();
    if (isRunning) return;
    set({ totalDuration: minutes, timeLeft: minutes * 60 });
  },

  start: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    const ref = setInterval(() => get().tick(), 1000);
    set({ isRunning: true, isPaused: false, intervalRef: ref });
  },

  pause: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    set({ isPaused: true, intervalRef: null });
  },

  resume: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    const ref = setInterval(() => get().tick(), 1000);
    set({ isPaused: false, intervalRef: ref });
  },

  reset: () => {
    const { intervalRef } = get();
    if (intervalRef) clearInterval(intervalRef);
    set({
      isRunning: false,
      isPaused: false,
      timeLeft: get().totalDuration * 60,
      intervalRef: null,
    });
  },

  minimize: () => set({ isMinimized: true }),

  expand: () => set({ isMinimized: false }),

  tick: () => {
    const { timeLeft, selectedTaskId, selectedTaskTitle, totalDuration, intervalRef } = get();
    if (timeLeft <= 1) {
      if (intervalRef) clearInterval(intervalRef);
      // Record completion
      const record: PomodoroRecord = {
        taskId: selectedTaskId,
        taskTitle: selectedTaskTitle || '未命名任务',
        duration: totalDuration,
        completedAt: Date.now(),
      };
      const history = [...get().history, record];
      saveHistory(history);

      set({
        timeLeft: 0,
        isRunning: false,
        isPaused: false,
        isMinimized: false,
        intervalRef: null,
        history,
      });

      // System notification
      try {
        (window as any).api?.notify?.pomodoroComplete?.(selectedTaskTitle);
      } catch {}

      // Sound
      if (typeof window !== 'undefined') {
        new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+Af4CAgICAgICAgH9/f39/f39/f39/f4CAgICAgICAgH+AgH9/f39/f4B/f3+Af39/f39/gICAgICAgIB/f39/f39/gH9/f3+AgICAgICAgICAf39/f39/gH9/gICAgICAgICAgIB/f39/f4B/f3+AgICAgICAgICAf39/f39/f39/f39/f4B/f3+Af39/f39/f39/f39/f39/gH+Af4CAf39/f39/f39/f39/f4B/f3+Af4CAgICAgICAgICAf3+Af39/f39/f39/f4CAgICAgICAgIB/f3+Af39/f4B/gICAgICAgICAf39/f3+Af39/f39/gH+AgICAgICAgH9/f39/f39/gH9/f39/f39/f39/f3+AgICAf39/f3+Af39/f39/f3+Af4B/f39/f39/f3+AgICAf39/f39/gICAgICAgH9/gICAgICAgH+Af39/f39/f3+Af39/f39/f39/f39/f39/f39/f3+AgICAf39/f39/f39/f39/gICAgICAgH9/f3+AgICAgICAgICAf39/f3+AgICAgICAgICAf3+AgICAgICAgH9/f3+Af39/f39/f39/f39/f3+Af39/f39/f3+Af4B/f3+AgICAgICAgH9/f3+AgICAf39/f3+AgICAf39/f39/f4B/f39/f39/gICAgICAgH+Af39/gICAgICAgICAf3+AgICAf3+Af4B/f3+Af39/f39/f3+AgICAgICAgICAf3+Af39/f39/f3+Af4B/f39/f3+Af3+AgICAf39/f3+Af4B/gICAgICAgICA').play().catch(() => {});
      }
      return;
    }
    set({ timeLeft: timeLeft - 1 });
  },

  loadHistory: () => set({ history: loadHistory() }),
}));
