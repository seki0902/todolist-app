import '@testing-library/jest-dom';

// React 18 concurrent mode needs this for testing-library compatibility
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Polyfill DOM globals that jsdom may not expose — React 18's
// getActiveElementDeep uses instanceof checks against these
if (typeof HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = (globalThis as any).Element || class {};
}
if (typeof HTMLInputElement === 'undefined') {
  (globalThis as any).HTMLInputElement = (globalThis as any).HTMLElement || class {};
}
if (typeof HTMLSelectElement === 'undefined') {
  (globalThis as any).HTMLSelectElement = (globalThis as any).HTMLElement || class {};
}
if (typeof HTMLTextAreaElement === 'undefined') {
  (globalThis as any).HTMLTextAreaElement = (globalThis as any).HTMLElement || class {};
}

// Mock Electron's window.api — all store/IPC tests need this
const mockApi = {
  db: {
    createTask: () => {},
    updateTask: () => {},
    deleteTask: () => {},
    listTasks: () => {},
    createCategory: () => {},
    updateCategory: () => {},
    deleteCategory: () => {},
    listCategories: () => {},
    createTemplate: () => {},
    updateTemplate: () => {},
    deleteTemplate: () => {},
    listTemplates: () => {},
    applyTemplate: () => {},
  },
  tag: {
    create: () => {},
    delete: () => {},
    list: () => {},
    getForTask: () => {},
    getForTasks: () => {},
    setTaskTags: () => {},
  },
  app: {
    onSync: () => () => {},
    removeSyncListener: () => {},
  },
  sticky: {
    toggle: () => {},
    setOpacity: () => {},
    focusMain: () => {},
    close: () => {},
  },
  backup: {
    getPath: () => {},
    backup: () => {},
    restore: () => {},
  },
  win: {
    minimize: () => {},
    maximize: () => {},
    close: () => {},
    isMaximized: () => {},
    onMaximizeChange: () => () => {},
  },
  notify: {
    pomodoroComplete: () => {},
  },
  ai: {
    parse: () => {},
  },
};

(globalThis as any).window = {
  ...(globalThis as any).window,
  api: mockApi,
};

// Mock localStorage
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
