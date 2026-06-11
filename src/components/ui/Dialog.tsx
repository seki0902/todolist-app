import React, { useEffect } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-[95vw] sm:max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {title && (
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
};
