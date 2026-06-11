/// <reference types="vite/client" />

import type { FocusFlowAPI } from './electron-main/preload/preload';

declare global {
  interface Window {
    api: FocusFlowAPI;
  }
}

export {};
