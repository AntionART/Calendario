const { BrowserWindow, app } = require('electron');
const path = require('path');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 840,
    minHeight: 600,
    show: false,
    center: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    title: 'Panel de Control - Calendario NEUROCOOP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'electron-admin-ui', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (e) => {
    if (!global.__isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
}

module.exports = { createMainWindow, getMainWindow, showMainWindow };
