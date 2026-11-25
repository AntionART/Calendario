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
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleString('es-CO');
  } catch {
    return String(d);
  }
}

function switchTab(viewName) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (btn) btn.classList.add('active');
  const targetView = $('view-' + viewName);
  if (targetView) targetView.classList.add('active');

  if (viewName === 'logs') refreshLogs();
  if (viewName === 'backups') refreshBackups();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.view));
});

$('btnGoBackups')?.addEventListener('click', () => switchTab('backups'));

function renderStatus(status) {
  const dot = $('statusDot');
  dot.classList.remove('on', 'off');
  dot.classList.add(status.running ? 'on' : 'off');
  $('statusText').textContent = status.running
    ? (status.externalManaged ? 'En línea (Servicio en Segundo Plano)' : 'En línea (Proceso Activo)')
    : 'Servicio Detenido';
  $('uptimeText').textContent = status.running ? formatUptime(status.uptimeMs) : 'Detenido';
  $('portText').textContent = status.port || '8765';
  $('btnStart').disabled = status.running;
  $('btnStop').disabled = !status.running;
  $('btnRestart').disabled = !status.running;
  $('btnOpenBrowser').disabled = !status.running;
  $('btnOpenAdmin').disabled = !status.running;
}

async function refreshStatus() {
  const status = await api.serverStatus();
  renderStatus(status);
}

api.onServerStatusChanged(renderStatus);

$('btnStart')?.addEventListener('click', async () => {
  $('btnStart').disabled = true;
  await api.serverStart();
  await refreshStatus();
  await refreshLinks();
});

$('btnStop')?.addEventListener('click', async () => {
  if (!confirm('¿Seguro que deseas detener el servicio del Calendario?')) return;
  $('btnStop').disabled = true;
  await api.serverStop();
  await refreshStatus();
  await refreshLinks();
});

$('btnRestart')?.addEventListener('click', async () => {
  $('btnRestart').disabled = true;
  await api.serverRestart();
  await refreshStatus();
  await refreshLinks();
});

$('btnOpenBrowser')?.addEventListener('click', () => api.openPublicCalendar());
$('btnOpenAdmin')?.addEventListener('click', () => api.openAdminPanel());

setInterval(refreshStatus, 3000);

async function refreshTunnel() {
  const status = await api.tunnelStatus();
  if ($('tunnelStatus')) {
    $('tunnelStatus').textContent = status.running
      ? ('Activo - ' + (status.url || 'Conectado a Ngrok'))
      : 'Inactivo';
  }
  if ($('btnTunnelStart')) $('btnTunnelStart').disabled = status.running;
  if ($('btnTunnelStop')) $('btnTunnelStop').disabled = !status.running;
}

$('btnTunnelStart')?.addEventListener('click', async () => {
  try {
    await api.tunnelStart();
  } catch (e) {
    alert(e.message || String(e));
  }
  refreshTunnel();
  setTimeout(refreshLinks, 2000);
});

$('btnTunnelStop')?.addEventListener('click', async () => {
  await api.tunnelStop();
  refreshTunnel();
  refreshLinks();
});

setInterval(refreshTunnel, 6000);

function linkRow(label, url) {
  return `
    <tr>
      <td><strong>${label}</strong></td>
      <td class="link-url">${url}</td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btn-sm" data-copy="${url.replace(/"/g, '&quot;')}">Copiar</button>
      </td>
    </tr>
  `;
}

async function refreshLinks() {
  const links = await api.linksGet();
  const tb = $('linksTable')?.querySelector('tbody');
  if (!tb) return;

  if (!links.running) {
    tb.innerHTML = '<tr><td colspan="3" class="muted">El servidor está detenido. Inicie el servicio para ver las direcciones de acceso.</td></tr>';
    return;
  }

  const port = links.port || 8765;
  const rows = [];
  rows.push(linkRow('Servidor Local (Este equipo)', `http://localhost:${port}/`));
  rows.push(linkRow('Panel de Gestión Local', `http://localhost:${port}/gestion`));

  for (const ip of links.localIPs || []) {
    rows.push(linkRow(`Red Interna / Recepción (${ip})`, `http://${ip}:${port}/`));
  }

  if (links.tunnelRunning && links.tunnelUrl) {
    rows.push(linkRow('Acceso Remoto Seguro (Ngrok)', links.tunnelUrl));
  }

  tb.innerHTML = rows.join('');
  tb.querySelectorAll('button[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      api.copyToClipboard(btn.dataset.copy);
      const originalText = btn.textContent;
      btn.textContent = '¡Copiado!';
      setTimeout(() => { btn.textContent = originalText; }, 1500);
    });
  });
}

async function refreshLogs() {
  const lines = await api.logsTail(250);
  const box = $('logBox');
  if (box) {
    box.textContent = lines && lines.length ? lines.join('\n') : 'No hay registros recientes.';
    box.scrollTop = box.scrollHeight;
  }
}

$('btnRefreshLogs')?.addEventListener('click', refreshLogs);

async function refreshBackups() {
  const cfg = await api.configGet();
  if ($('backupFolder')) $('backupFolder').value = cfg.backupFolder || '';
  const list = await api.backupList(cfg.backupFolder);
  const tbody = $('backupList');
  if (!tbody) return;

  if (!list || !list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted">No se han encontrado copias de seguridad en esta carpeta.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(b => `
    <tr>
      <td><code>${b.name}</code></td>
      <td>${formatDate(b.mtime)}</td>
      <td>${formatSize(b.size)}</td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btn-sm" data-restore="${b.fullPath.replace(/"/g, '&quot;')}">Restaurar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.restore;
      if (!confirm(`¿Restaurar la copia de seguridad:\n${p}?\n\nLa base de datos actual será reemplazada de forma segura.`)) return;
      btn.disabled = true;
      try {
        await api.backupRestore(p);
        alert('Copia de seguridad restaurada exitosamente.');
      } catch (e) {
        alert('Error al restaurar: ' + (e.message || String(e)));
      }
      refreshBackups();
      refreshStatus();
    });
  });
}

$('btnChooseFolder')?.addEventListener('click', async () => {
  const f = await api.chooseFolder();
  if (f) {
    await api.configUpdate({ backupFolder: f });
    refreshBackups();
  }
});

$('btnCreateBackup')?.addEventListener('click', async () => {
  const btn = $('btnCreateBackup');
  btn.disabled = true;
  try {
    const res = await api.backupCreate();
    alert('Copia de seguridad creada con éxito:\n' + res.path);
  } catch (e) {
    alert('Error al crear copia: ' + (e.message || String(e)));
  }
  btn.disabled = false;
  refreshBackups();
});

$('btnQuickBackup')?.addEventListener('click', async () => {
  const btn = $('btnQuickBackup');
  btn.disabled = true;
  try {
    const res = await api.backupCreate();
    alert('Copia de seguridad instantánea creada:\n' + res.path);
  } catch (e) {
    alert('Error: ' + (e.message || String(e)));
  }
  btn.disabled = false;
});

$('btnExportAs')?.addEventListener('click', async () => {
  try {
    const path = await api.backupExportAs();
    if (path) alert('Copia exportada exitosamente a:\n' + path);
  } catch (e) {
    alert('Error al exportar: ' + (e.message || String(e)));
  }
});

$('btnImportRestore')?.addEventListener('click', async () => {
  if (!confirm('Importar una copia externa reemplazará la base de datos viva. ¿Deseas continuar?')) return;
  try {
    const path = await api.backupImportAndRestore();
    if (path) {
      alert('Base de datos importada y restaurada correctamente.');
      refreshStatus();
    }
  } catch (e) {
    alert('Error al importar: ' + (e.message || String(e)));
  }
});

async function loadConfig() {
  const cfg = await api.configGet();
  if ($('cfgPort')) $('cfgPort').value = cfg.port || 8765;
  if ($('cfgAutoLaunch')) $('cfgAutoLaunch').checked = await api.autoLaunchGet();

  const sched = cfg.backupSchedule || {};
  if ($('cfgBackupEnabled')) $('cfgBackupEnabled').checked = !!sched.enabled;
  if ($('cfgBackupInterval')) $('cfgBackupInterval').value = sched.intervalHours || 24;
  if ($('cfgBackupKeep')) $('cfgBackupKeep').value = sched.keepCount || 14;
}

$('btnSaveConfig')?.addEventListener('click', async () => {
  const port = parseInt($('cfgPort').value, 10);
  if (!port || port < 1024 || port > 65535) {
    alert('El puerto debe ser un número válido entre 1024 y 65535.');
    return;
  }
  await api.configUpdate({ port });
  await api.autoLaunchSet($('cfgAutoLaunch').checked);
  alert('Ajustes guardados correctamente.');
});

$('btnSaveBackupSchedule')?.addEventListener('click', async () => {
  const enabled = $('cfgBackupEnabled').checked;
  const intervalHours = parseInt($('cfgBackupInterval').value, 10) || 24;
  const keepCount = parseInt($('cfgBackupKeep').value, 10) || 14;
  await api.configUpdate({
    backupSchedule: { enabled, intervalHours, keepCount }
  });
  alert('Programación de respaldos guardada.');
});

async function init() {
  await refreshStatus();
  await refreshTunnel();
  await refreshLinks();
  await loadConfig();
}

init();
