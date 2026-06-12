import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Debug helper — renders error to DOM before React boots
function showFatalError(msg: string) {
  document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:red;background:#1a1a1a;min-height:100vh"><h1>FocusFlow Startup Error</h1><pre style="white-space:pre-wrap;font-size:13px">${msg}</pre></div>`;
}

// Catch ALL errors — sync, async, and unhandled rejections
window.addEventListener('error', (e) => {
  const msg = `[window.onerror] ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`;
  document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:red;background:#1a1a1a;min-height:100vh"><h1>FocusFlow JS Error</h1><pre style="white-space:pre-wrap;font-size:13px">${msg}\n\nStack: ${e.error?.stack || 'none'}</pre></div>`;
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = `[unhandledrejection] ${e.reason}`;
  document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:red;background:#1a1a1a;min-height:100vh"><h1>FocusFlow Async Error</h1><pre style="white-space:pre-wrap;font-size:13px">${msg}\n\nStack: ${e.reason?.stack || 'none'}</pre></div>`;
});

// Minimal render test first — does React even boot?
try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    showFatalError('No #root element found in DOM');
  } else {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  }
} catch (err) {
  showFatalError(`React bootstrap error: ${err instanceof Error ? err.message + '\n' + err.stack : String(err)}`);
}
