const api = window.calendarioAdmin;

function $(id) { return document.getElementById(id); }

function formatUptime(ms) {
  if (!ms || ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  parts.push(sec + 's');
  return parts.join(' ');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(d) {
  return new Date(d).toLocaleString('es-CO');
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'logs') refreshLogs();
    if (btn.dataset.view === 'backups') refreshBackups();
  });
});

function renderStatus(status) {
  const dot = $('statusDot');
  dot.classList.remove('on', 'off');
  dot.classList.add(status.running ? 'on' : 'off');
  $('statusText').textContent = status.running ? 'En ejecucion' : 'Detenido';
  $('uptimeText').textContent = status.running ? formatUptime(status.uptimeMs) : '-';
  $('portText').textContent = status.port || '-';
  $('btnStart').disabled = status.running;
  $('btnStop').disabled = !status.running;
  $('btnRestart').disabled = !status.running;
  $('btnOpenBrowser').disabled = !status.running || !status.port;
}

async function refreshStatus() {
  const status = await api.serverStatus();
  renderStatus(status);
}

api.onServerStatusChanged(renderStatus);

$('btnStart').addEventListener('click', async () => { $('btnStart').disabled = true; await api.serverStart(); refreshStatus(); refreshLinks(); });
$('btnStop').addEventListener('click', async () => { $('btnStop').disabled = true; await api.serverStop(); refreshStatus(); refreshLinks(); });
$('btnRestart').addEventListener('click', async () => { $('btnRestart').disabled = true; await api.serverRestart(); refreshStatus(); refreshLinks(); });
$('btnOpenBrowser').addEventListener('click', () => api.openBrowser());

setInterval(refreshStatus, 3000);

async function refreshTunnel() {
  const status = await api.tunnelStatus();
  $('tunnelStatus').textContent = status.running
    ? ('Activo' + (status.url ? ' - ' + status.url : ''))
    : 'Detenido';
  $('btnTunnelStart').disabled = status.running;
  $('btnTunnelStop').disabled = !status.running;
}

$('btnTunnelStart').addEventListener('click', async () => {
  try {
    await api.tunnelStart();
  } catch (e) {
    alert(e.message || String(e));
  }
  refreshTunnel();
  setTimeout(refreshLinks, 2000);
});

$('btnTunnelStop').addEventListener('click', async () => {
  await api.tunnelStop();
  refreshTunnel();
  refreshLinks();
});

setInterval(refreshTunnel, 5000);

function linkRow(label, url) {
  return `
    <tr>
      <td>${label}</td>
      <td class="link-url">${url}</td>
      <td><button class="btn btn-secondary" data-copy="${url.replace(/"/g, '&quot;')}">Copiar</button></td>
    </tr>
  `;
}

async function refreshLinks() {
  const info = await api.linksGet();
  const tbody = document.querySelector('#linksTable tbody');

  if (!info.running || !info.port) {
    tbody.innerHTML = '<tr><td colspan="3">El servidor esta detenido.</td></tr>';
    return;
  }

  const rows = [];
  rows.push(linkRow('Local', `http://localhost:${info.port}/`));
  for (const ip of info.localIPs) {
    rows.push(linkRow('Red interna', `http://${ip}:${info.port}/`));
  }
  if (info.tunnelRunning && info.tunnelUrl) {
    rows.push(linkRow('Internet', info.tunnelUrl));
  } else {
    rows.push('<tr><td>Internet</td><td class="link-url">Tunel desactivado</td><td></td></tr>');
  }
  rows.push(linkRow('Gestion (admin)', `http://localhost:${info.port}/gestion`));

  tbody.innerHTML = rows.join('');

  tbody.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.copyToClipboard(btn.getAttribute('data-copy'));
      const original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });
}

setInterval(refreshLinks, 5000);

async function refreshLogs() {
  const lines = await api.logsTail(300);
  const box = $('logBox');
  box.textContent = lines.length ? lines.join('\n') : 'Sin datos aun.';
  box.scrollTop = box.scrollHeight;
}

$('btnRefreshLogs').addEventListener('click', refreshLogs);

async function refreshBackups() {
  const cfg = await api.configGet();
  $('backupFolder').value = cfg.backupFolder;

  const list = await api.backupList();
  const tbody = $('backupList');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4">Aun no hay copias de seguridad.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(b => `
    <tr>
      <td>${b.file}</td>
      <td>${formatDate(b.mtime)}</td>
      <td>${formatSize(b.size)}</td>
      <td><button class="btn btn-secondary" data-restore="${b.path.replace(/"/g, '&quot;')}">Restaurar</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.getAttribute('data-restore');
      if (!confirm('Esto reemplazara la base de datos actual con esta copia. El servidor se reiniciara. ¿Continuar?')) return;
      btn.disabled = true;
      try {
        await api.backupRestore(p);
        alert('Restauracion completada.');
      } catch (e) {
        alert('Error al restaurar: ' + (e.message || e));
      }
      refreshStatus();
      refreshBackups();
    });
  });
}

$('btnChooseFolder').addEventListener('click', async () => {
  const folder = await api.chooseFolder();
  if (folder) {
    await api.configUpdate({ backupFolder: folder });
    refreshBackups();
  }
});

$('btnCreateBackup').addEventListener('click', async () => {
  $('btnCreateBackup').disabled = true;
  try {
    await api.backupCreate();
    alert('Copia de seguridad creada.');
  } catch (e) {
    alert('Error al crear la copia: ' + (e.message || e));
  }
  $('btnCreateBackup').disabled = false;
  refreshBackups();
});

$('btnExportAs').addEventListener('click', async () => {
  $('btnExportAs').disabled = true;
  try {
    const dest = await api.backupExportAs();
    if (dest) alert('Copia exportada a:\n' + dest);
  } catch (e) {
    alert('Error al exportar la copia: ' + (e.message || e));
  }
  $('btnExportAs').disabled = false;
  refreshBackups();
});

$('btnImportRestore').addEventListener('click', async () => {
  if (!confirm('Esto reemplazara la base de datos actual con el archivo que elijas. El servidor se reiniciara. ¿Continuar?')) return;
  $('btnImportRestore').disabled = true;
  try {
    const src = await api.backupImportAndRestore();
    if (src) alert('Base de datos restaurada desde:\n' + src);
  } catch (e) {
    alert('Error al importar/restaurar: ' + (e.message || e));
  }
  $('btnImportRestore').disabled = false;
  refreshStatus();
  refreshBackups();
});

async function loadConfig() {
  const cfg = await api.configGet();
  $('cfgPort').value = cfg.port;
  $('cfgAutoLaunch').checked = await api.autoLaunchGet();
  $('cfgBackupEnabled').checked = !!(cfg.backupSchedule && cfg.backupSchedule.enabled);
  $('cfgBackupInterval').value = (cfg.backupSchedule && cfg.backupSchedule.intervalHours) || 24;
  $('cfgBackupKeep').value = (cfg.backupSchedule && cfg.backupSchedule.keepCount) || 14;
}

$('btnSaveConfig').addEventListener('click', async () => {
  const port = Number($('cfgPort').value) || 8765;
  await api.configUpdate({ port });
  await api.autoLaunchSet($('cfgAutoLaunch').checked);
  alert('Configuracion guardada. Reinicie el servidor para aplicar el nuevo puerto.');
});

$('btnSaveBackupSchedule').addEventListener('click', async () => {
  await api.configUpdate({
    backupSchedule: {
      enabled: $('cfgBackupEnabled').checked,
      intervalHours: Number($('cfgBackupInterval').value) || 24,
      keepCount: Number($('cfgBackupKeep').value) || 14
    }
  });
  alert('Programacion de backups guardada.');
});

refreshStatus();
refreshTunnel();
refreshLinks();
loadConfig();
