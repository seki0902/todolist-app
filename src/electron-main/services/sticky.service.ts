import { BrowserWindow, screen, ipcMain, app, Menu } from 'electron';
import path from 'path';
import fs from 'fs';

let stickyWindow: BrowserWindow | null = null;

const POSITION_FILE = 'sticky-position.json';

function getPositionPath(): string {
  return path.join(app.getPath('userData'), POSITION_FILE);
}

function savePosition(x: number, y: number, width: number, height: number): void {
  try {
    fs.writeFileSync(getPositionPath(), JSON.stringify({ x, y, width, height }));
  } catch {}
}

function loadPosition(): { x: number; y: number; width: number; height: number } | null {
  try {
    const raw = fs.readFileSync(getPositionPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createStickyWindow(): BrowserWindow {
  if (stickyWindow && !stickyWindow.isDestroyed()) {
    stickyWindow.focus();
    return stickyWindow;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const saved = loadPosition();

  const defaultX = screenWidth - 340;
  const defaultY = 80;
  const defaultW = 280;
  const defaultH = 420;

  stickyWindow = new BrowserWindow({
    width: saved?.width ?? defaultW,
    height: saved?.height ?? defaultH,
    x: saved?.x ?? defaultX,
    y: saved?.y ?? defaultY,
    minWidth: 200,
    minHeight: 280,
    maxWidth: 400,
    maxHeight: 700,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'FocusFlow 便签',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    stickyWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/sticky`);
  } else {
    stickyWindow.loadFile(
      path.join(__dirname, '../../dist/index.html'),
      { hash: '/sticky' }
    );
  }

  stickyWindow.setVisibleOnAllWorkspaces(true);

  // Right-click context menu
  stickyWindow.webContents.on('context-menu', () => {
    const isPinned = stickyWindow?.isAlwaysOnTop() ?? false;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '固定在页面上方',
        type: 'checkbox',
        checked: isPinned,
        click: () => {
          if (stickyWindow && !stickyWindow.isDestroyed()) {
            const newPinned = !isPinned;
            stickyWindow.setAlwaysOnTop(newPinned, 'floating');
          }
        },
      },
      { type: 'separator' },
      {
        label: '透明度',
        submenu: [
          { label: '60%', type: 'radio', checked: false, click: () => stickyWindow?.setOpacity(0.6) },
          { label: '70%', type: 'radio', checked: false, click: () => stickyWindow?.setOpacity(0.7) },
          { label: '80%', type: 'radio', checked: false, click: () => stickyWindow?.setOpacity(0.8) },
          { label: '90%', type: 'radio', checked: false, click: () => stickyWindow?.setOpacity(0.9) },
          { label: '100%', type: 'radio', checked: false, click: () => stickyWindow?.setOpacity(1.0) },
        ],
      },
      { type: 'separator' },
      {
        label: '关闭便签',
        click: () => {
          if (stickyWindow && !stickyWindow.isDestroyed()) {
            stickyWindow.close();
          }
        },
      },
    ]);
    contextMenu.popup();
  });

  // Save position on move/resize
  stickyWindow.on('moved', () => {
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      const [x, y] = stickyWindow.getPosition();
      const [w, h] = stickyWindow.getSize();
      savePosition(x, y, w, h);
    }
  });

  stickyWindow.on('resized', () => {
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      const [x, y] = stickyWindow.getPosition();
      const [w, h] = stickyWindow.getSize();
      savePosition(x, y, w, h);
    }
  });

  stickyWindow.on('closed', () => {
    stickyWindow = null;
  });

  return stickyWindow;
}

export function toggleStickyWindow(): void {
  if (stickyWindow && !stickyWindow.isDestroyed()) {
    stickyWindow.close();
  } else {
    createStickyWindow();
  }
}

export function focusMainWindow(): void {
  const mainWin = BrowserWindow.getAllWindows().find(
    (w) => w.id !== stickyWindow?.id && !w.isDestroyed()
  );
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.focus();
  }
}

export function getStickyWindow(): BrowserWindow | null {
  if (stickyWindow && !stickyWindow.isDestroyed()) {
    return stickyWindow;
  }
  return null;
}

export function registerStickyIpcHandlers(): void {
  ipcMain.handle('sticky:toggle', () => {
    toggleStickyWindow();
    return { success: true };
  });

  ipcMain.handle('sticky:setOpacity', (_event, opacity: number) => {
    const win = getStickyWindow();
    if (win) {
      win.setOpacity(Math.max(0.1, Math.min(1, opacity)));
    }
    return { success: true };
  });

  ipcMain.handle('sticky:focusMain', () => {
    focusMainWindow();
    return { success: true };
  });
}
