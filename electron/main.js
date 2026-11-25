const { app } = require('electron');
const serverProcess = require('./serverProcess');
const backupManager = require('./backupManager');
const windows = require('./windows');
const tray = require('./tray');
const { registerIpcHandlers } = require('./ipc');
const logger = require('./logger');

process.on('uncaughtException', (err) => {
  logger.appendServerLine(`[EXCEPCION NO CAPTURADA EN ELECTRON] ${err.stack || err.message}`);
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    windows.showMainWindow();
  });

  app.whenReady().then(() => {
    const mainWindow = windows.createMainWindow();
    tray.createTray();
    registerIpcHandlers(mainWindow);
    serverProcess.start();
    backupManager.applySchedule();
  }).catch(err => {
    logger.appendServerLine(`[ERROR AL INICIALIZAR] ${err.stack || err.message}`);
  });

  app.on('window-all-closed', () => {
    // La app vive en la bandeja del sistema; no se cierra al cerrar la ventana.
  });

  app.on('before-quit', async (e) => {
    if (!global.__quitHandled) {
      e.preventDefault();
      global.__quitHandled = true;
      await serverProcess.stop();
      global.__isQuitting = true;
      app.quit();
    }
  });
}
