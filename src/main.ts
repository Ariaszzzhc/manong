import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { setupIPC } from './main/ipc';
import { mcpManager } from './main/services/mcp';
import { lspManager } from './main/services/lsp';
import { storageService } from './main/services/storage';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const buildMenu = () => {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Let the renderer handle it — just prevent Chromium's default
            mainWindow?.webContents.send('menu:new-session');
          },
        },
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-folder');
          },
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow?.close();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindow = async () => {
  // Create the browser window with frameless design
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: isMac ? undefined : false,
    ...(isMac
      ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 12 } }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Setup IPC handlers
  setupIPC(mainWindow);

  // Build application menu to capture Ctrl+N/Ctrl+W
  buildMenu();

  // Initialize MCP and connect to servers
  try {
    await mcpManager.initialize();
    await mcpManager.connectAll();
  } catch (error) {
    console.error('Failed to initialize MCP:', error);
  }

  // Initialize LSP manager
  try {
    const currentWorkspacePath = storageService.getCurrentWorkspacePath();
    await lspManager.initialize(currentWorkspacePath || undefined);
  } catch (error) {
    console.error('Failed to initialize LSP:', error);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
