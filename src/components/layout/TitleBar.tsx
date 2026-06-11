import React, { useState, useEffect } from 'react';
import { Minus, Square, X, BookOpen } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    (window as any).api?.win?.isMaximized?.().then((v: boolean) => setIsMaximized(v));
    const cleanup = (window as any).api?.app?.onMaximizeChange?.((max: boolean) => setIsMaximized(max));
  }, []);

  const api = (window as any).api;

  return (
    <div
      className="flex items-center h-10 glass-titlebar select-none flex-shrink-0 z-50"
      style={{ WebkitAppRegion: 'drag' as any }}
    >
      {/* App brand */}
      <div className="flex items-center gap-2 pl-4">
        <span className="text-base">🎯</span>
        <span className="text-xs font-semibold text-foreground">FocusFlow</span>
      </div>

      {/* Spacer — drag region */}
      <div className="flex-1" />

      {/* Notebook-styled sticky note button */}
      <div style={{ WebkitAppRegion: 'no-drag' as any }}>
        <button
          onClick={() => api?.sticky?.toggle?.()}
          className="flex items-center gap-1.5 mr-1 px-2.5 py-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="桌面便签"
        >
          <BookOpen className="h-4 w-4" />
          <span className="text-[11px] font-medium">便签</span>
        </button>
      </div>

      {/* Window controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <button
          onClick={() => api?.win?.minimize?.()}
          className="h-9 w-11 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => api?.win?.maximize?.()}
          className="h-9 w-11 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={() => api?.win?.close?.()}
          className="h-9 w-11 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
