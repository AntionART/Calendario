const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calendarioAdmin', {
  serverStart: () => ipcRenderer.invoke('server:start'),
  serverStop: () => ipcRenderer.invoke('server:stop'),
  serverRestart: () => ipcRenderer.invoke('server:restart'),
  serverStatus: () => ipcRenderer.invoke('server:status'),
  onServerStatusChanged: (cb) => {
    const listener = (_e, status) => cb(status);
    ipcRenderer.on('server:status-changed', listener);
    return () => ipcRenderer.removeListener('server:status-changed', listener);
  },

  logsTail: (n) => ipcRenderer.invoke('logs:tail', n),

  backupCreate: (folder) => ipcRenderer.invoke('backup:create', folder),
  backupList: (folder) => ipcRenderer.invoke('backup:list', folder),
  backupRestore: (backupPath) => ipcRenderer.invoke('backup:restore', backupPath),
  backupExportAs: () => ipcRenderer.invoke('backup:exportAs'),
  backupImportAndRestore: () => ipcRenderer.invoke('backup:importAndRestore'),

  configGet: () => ipcRenderer.invoke('config:get'),
  configUpdate: (patch) => ipcRenderer.invoke('config:update', patch),

  autoLaunchGet: () => ipcRenderer.invoke('autolaunch:get'),
  autoLaunchSet: (enabled) => ipcRenderer.invoke('autolaunch:set', enabled),

  tunnelStart: () => ipcRenderer.invoke('tunnel:start'),
  tunnelStop: () => ipcRenderer.invoke('tunnel:stop'),
  tunnelStatus: () => ipcRenderer.invoke('tunnel:status'),

  openPublicCalendar: () => ipcRenderer.invoke('open:publicCalendar'),
  openAdminPanel: () => ipcRenderer.invoke('open:adminPanel'),
  chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),

  linksGet: () => ipcRenderer.invoke('links:get'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text)
});
