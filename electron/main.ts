import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, closeDatabase } from './database.js';
import { registerHandlers } from './handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if running in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false, // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    // Load from Vite dev server in development
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Load from built files in production
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Keyboard shortcut to toggle DevTools (Ctrl+Shift+I or Cmd+Shift+I)
  // DevTools do NOT open automatically per spec requirements
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (
      input.key === 'I' &&
      input.control &&
      input.shift &&
      input.type === 'keyDown'
    ) {
      mainWindow?.webContents.toggleDevTools();
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  try {
    // Initialize database and run migrations
    console.log('Initializing database...');
    await runMigrations();
    console.log('✓ Database initialized');

    // Register IPC handlers
    registerHandlers();

    // Create window
    createWindow();

    app.on('activate', () => {
      // On macOS it's common to re-create a window when dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

// Clean up before quitting
app.on('before-quit', () => {
  closeDatabase();
});
