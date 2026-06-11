import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FocusFlow] Render error:', error);
    console.error('[FocusFlow] Component stack:', info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
            <span className="text-5xl">⚠️</span>
            <h1 className="text-xl font-semibold text-foreground">应用遇到了问题</h1>
            <p className="text-sm text-muted-foreground">
              发生了未预期的渲染错误，请尝试重新加载。
            </p>
            {this.state.error && (
              <pre className="w-full max-h-32 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground text-left">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
