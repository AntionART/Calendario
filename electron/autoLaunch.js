const AutoLaunch = require('auto-launch');
const { app } = require('electron');

let instance = null;

function getInstance() {
  if (!instance) {
    instance = new AutoLaunch({ name: 'CalendarioNeurocoop', path: app.getPath('exe') });
  }
  return instance;
}

async function isEnabled() {
  try {
    return await getInstance().isEnabled();
  } catch {
    return false;
  }
}

async function setEnabled(enabled) {
  const al = getInstance();
  const currentlyEnabled = await al.isEnabled().catch(() => false);
  if (enabled && !currentlyEnabled) await al.enable();
  if (!enabled && currentlyEnabled) await al.disable();
  return enabled;
}

module.exports = { isEnabled, setEnabled };
