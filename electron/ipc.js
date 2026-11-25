const { ipcMain, shell, dialog, clipboard } = require('electron');
const serverProcess = require('./serverProcess');
const backupManager = require('./backupManager');
const tunnelManager = require('./tunnelManager');
const autoLaunch = require('./autoLaunch');
const logger = require('./logger');
const { getConfig, updateConfig } = require('../shared/configStore');

function registerIpcHandlers(mainWindow) {
  ipcMain.handle('server:start', () => serverProcess.start());
  ipcMain.handle('server:stop', () => serverProcess.stop());
  ipcMain.handle('server:restart', () => serverProcess.restart());
  ipcMain.handle('server:status', () => serverProcess.getStatus());

  ipcMain.handle('logs:tail', (_e, n) => logger.getLastLines(n || 250));

  ipcMain.handle('backup:create', (_e, folder) => backupManager.createBackup(folder));
  ipcMain.handle('backup:list', (_e, folder) => backupManager.listBackups(folder));
  ipcMain.handle('backup:restore', (_e, backupPath) => backupManager.restoreBackup(backupPath));

  ipcMain.handle('backup:exportAs', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar copia de seguridad como...',
      defaultPath: `calendario-${backupManager.timestamp()}.db`,
      filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }]
    });
    if (result.canceled || !result.filePath) return null;
    return backupManager.backupToPath(result.filePath);
  });

  ipcMain.handle('backup:importAndRestore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar copia de seguridad (.db) para restaurar',
      properties: ['openFile'],
      filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }]
    });
    if (result.canceled || !result.filePaths.length) return null;
    await backupManager.restoreBackup(result.filePaths[0]);
    return result.filePaths[0];
  });

  ipcMain.handle('config:get', () => getConfig());
  ipcMain.handle('config:update', (_e, patch) => {
    const cfg = updateConfig(patch);
    if (patch.backupSchedule) backupManager.applySchedule();
    return cfg;
  });

  ipcMain.handle('autolaunch:get', () => autoLaunch.isEnabled());
  ipcMain.handle('autolaunch:set', (_e, enabled) => autoLaunch.setEnabled(enabled));

  ipcMain.handle('tunnel:start', () => tunnelManager.start());
  ipcMain.handle('tunnel:stop', () => tunnelManager.stop());
  ipcMain.handle('tunnel:status', () => tunnelManager.getStatus());

  ipcMain.handle('open:publicCalendar', () => {
    const status = serverProcess.getStatus();
    const port = status.port || 8765;
    shell.openExternal(`http://localhost:${port}/`);
  });

  ipcMain.handle('open:adminPanel', () => {
    const status = serverProcess.getStatus();
    const port = status.port || 8765;
    shell.openExternal(`http://localhost:${port}/gestion`);
  });

  ipcMain.handle('links:get', async () => {
    const status = serverProcess.getStatus();
    const tunnel = await tunnelManager.getStatus();
    return {
      running: status.running,
      port: status.port || 8765,
      localIPs: serverProcess.getLocalIPs(),
      tunnelRunning: tunnel.running,
      tunnelUrl: tunnel.url
    };
  });

  ipcMain.handle('clipboard:write', (_e, text) => {
    clipboard.writeText(text);
  });

  ipcMain.handle('dialog:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  serverProcess.onStatusChange(status => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server:status-changed', status);
    }
  });
}

module.exports = { registerIpcHandlers };
