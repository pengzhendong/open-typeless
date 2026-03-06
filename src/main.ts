import 'dotenv/config';
import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Import logger first to configure electron-log before other modules
import { logger } from './main/logger';
import { setupAllIpcHandlers } from './main/ipc';
import { floatingWindow } from './main/windows';
import { pushToTalkService, permissionsService } from './main/services';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Setup IPC handlers before app is ready
setupAllIpcHandlers();

const createWindow = async () => {
  // Request microphone permission on app launch
  // This triggers the system permission dialog if not yet determined
  logger.info('Requesting microphone permission...');
  const microphoneGranted = await permissionsService.requestMicrophonePermission();

  if (!microphoneGranted) {
    logger.warn('Microphone permission not granted. Voice input will not work.');

    // Show dialog to guide user to settings
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Open Settings', 'Cancel'],
      title: 'Microphone Permission Required',
      message: 'Microphone permission is required for voice input.',
      detail: 'Please grant microphone access in System Settings > Privacy & Security > Microphone, then restart the app.',
    });

    if (result.response === 0) {
      // User clicked "Open Settings"
      permissionsService.openSettings('microphone');
    }
  } else {
    logger.info('Microphone permission granted');
  }

  // Create the browser window (hidden - app runs in background)
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Start hidden, no window popup
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Create the floating window (hidden initially)
  floatingWindow.create();

  // Initialize push-to-talk service after windows are created
  pushToTalkService.initialize();
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

// Cleanup function for graceful shutdown
function cleanup(): void {
  pushToTalkService.dispose();
  floatingWindow.destroy();
}

// Clean up before quitting
app.on('before-quit', cleanup);

// Handle SIGINT (Ctrl+C) and SIGTERM for graceful shutdown
process.on('SIGINT', () => {
  cleanup();
  app.quit();
});

process.on('SIGTERM', () => {
  cleanup();
  app.quit();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
