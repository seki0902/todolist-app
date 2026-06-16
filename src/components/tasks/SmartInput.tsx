import React, { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { ParseResult } from '../../shared/types/ai';

interface SmartInputProps {
  onResults: (results: ParseResult[], rawText: string) => void;
  disabled?: boolean;
}

const EXAMPLES = [
  '每天健身30分钟',
  '每周一上午9点站会，每周五下午5点周报',
  '明天下午去超市买菜，后天交房租',
  '紧急：修复登录页面的 bug',
];

export const SmartInput: React.FC<SmartInputProps> = ({ onResults, disabled }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleParse = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('请输入任务描述');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await window.api.ai.parse(trimmed);
      if (res.success && res.data) {
          onResults(res.data, trimmed);
          setText('');
      } else {
        setError(res.error || '解析失败，请重试');
      }
    } catch {
      setError('解析服务不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter to parse
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleParse();
    }
  };

  const handleExampleClick = (example: string) => {
    setText(example);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="px-6 py-3 border-b border-border bg-background/50">
      <div className={`relative rounded-xl border-2 border-dashed transition-colors ${
        shake
          ? 'border-red-400 animate-[shake_0.3s_ease-in-out]'
          : error
            ? 'border-red-400/60'
            : 'border-purple-400/40 hover:border-purple-400/70 focus-within:border-purple-400'
      } bg-purple-50/30 dark:bg-purple-950/20`}>
        <div className="flex items-start gap-3 p-3">
          <span className="mt-2 text-lg flex-shrink-0">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            ) : (
              <span>🤖</span>
            )}
          </span>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="用自然语言描述你要做的事，AI 自动拆分..."
            disabled={loading || disabled}
            rows={2}
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <button
            onClick={handleParse}
            disabled={loading || disabled || !text.trim()}
            className="flex-shrink-0 mt-1 px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '解析中...' : '智能解析'}
          </button>
        </div>

        {/* Examples */}
        {!text.trim() && !error && (
          <div className="flex items-center gap-2 px-3 pb-3 flex-wrap">
            <span className="text-[10px] text-muted-foreground">试试:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => handleExampleClick(ex)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-purple-300/50 dark:border-purple-600/50 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-xs text-red-500 pl-1">{error}</p>
      )}

      {/* Keyboard hint */}
      <p className="mt-1 text-[10px] text-muted-foreground pl-1">
        Ctrl + Enter 快速解析
      </p>
    </div>
  );
};
