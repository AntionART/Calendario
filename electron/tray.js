const { Tray, Menu, app, shell } = require('electron');
const path = require('path');
const serverProcess = require('./serverProcess');
const windows = require('./windows');

let tray = null;

function buildMenu() {
  const status = serverProcess.getStatus();
  return Menu.buildFromTemplate([
    { label: 'Calendario NEUROCOOP', enabled: false },
    { label: status.running ? 'Estado: en ejecucion' : 'Estado: detenido', enabled: false },
    { type: 'separator' },
    { label: 'Mostrar panel', click: () => windows.showMainWindow() },
    {
      label: 'Abrir calendario en navegador',
      enabled: status.running && !!status.port,
      click: () => shell.openExternal(`http://localhost:${status.port}/`)
    },
    { type: 'separator' },
    { label: 'Iniciar servidor', enabled: !status.running, click: () => serverProcess.start() },
    { label: 'Detener servidor', enabled: status.running, click: () => serverProcess.stop() },
    { label: 'Reiniciar servidor', enabled: status.running, click: () => serverProcess.restart() },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        global.__isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'build', 'icon.ico'));
  tray.setToolTip('Calendario NEUROCOOP');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => windows.showMainWindow());
  serverProcess.onStatusChange(() => tray.setContextMenu(buildMenu()));
  return tray;
}

module.exports = { createTray };
