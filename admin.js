import {
  apiRequest,
  createToast,
  fillForm,
  getConfig,
  healthCheck,
  readForm,
  requireField,
  saveConfig,
  setHealthStatus,
} from './shared.js';

const toast = createToast();
const connectionForm = document.getElementById('connectionForm');
const testBtn = document.getElementById('testHealth');
const refreshStatusBtn = document.getElementById('refreshStatus');
const refreshLogsBtn = document.getElementById('refreshLogs');
const statusGrid = document.getElementById('statusGrid');
const logsTable = document.getElementById('logsTable');

const djEnableBtn = document.getElementById('djEnable');
const djDisableBtn = document.getElementById('djDisable');
const idleApplyBtn = document.getElementById('idleApply');

const runHealthCheck = async (config = getConfig()) => {
  try {
    await healthCheck(config);
    setHealthStatus(true, 'API online');
  } catch (err) {
    setHealthStatus(false, 'Offline');
    throw err;
  }
};

const refreshStatus = async () => {
  const config = getConfig();
  const statuses = await apiRequest(config, '/api/v1/admin/status');
  if (!statusGrid) return;
  statusGrid.innerHTML = '';
  statuses.forEach((item) => {
    const div = document.createElement('div');
    const ok = Boolean(item.ok);
    div.className = 'queue-item';
    div.innerHTML = `
      <div class="section-title">
        <strong>${item.name}</strong>
        <span class="tag" style="color:${ok ? 'var(--ok)' : 'var(--danger)'}">${ok ? 'ok' : 'down'}</span>
      </div>
      <div class="mono">${item.message || ''}</div>
    `;
    statusGrid.appendChild(div);
  });
};

const refreshLogs = async () => {
  const config = getConfig();
  const limitInput = document.getElementById('logLimit');
  const limit = Math.max(1, Math.min(500, Number(limitInput?.value || 200)));
  const logs = await apiRequest(config, '/api/v1/admin/logs', {
    query: {limit},
  });

  if (!logsTable) return;
  logsTable.innerHTML = '';
  logs.forEach((entry) => {
    const row = document.createElement('tr');
    const ts = new Date(entry.ts).toLocaleTimeString();
    row.innerHTML = `
      <td>${ts}</td>
      <td>${String(entry.level || '').toUpperCase()}</td>
      <td>${String(entry.message || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</td>
    `;
    logsTable.appendChild(row);
  });
};

const djAction = async (mode) => {
  const config = getConfig();
  requireField(config, 'guildId', 'Guild ID');
  if (!config.userId) {
    toast('User ID required if mods-only admin is enabled.');
  }
  const seedInput = document.getElementById('djSeed');
  const channelInput = document.getElementById('djChannelId');
  const payload = {
    guildId: config.guildId,
    userId: config.userId || undefined,
    seed: seedInput?.value.trim() || undefined,
    channelId: channelInput?.value.trim() || config.channelId || undefined,
  };
  await apiRequest(config, `/api/v1/admin/dj/${mode}`, {method: 'POST', body: payload});
};

const updateIdleTimeout = async () => {
  const config = getConfig();
  requireField(config, 'guildId', 'Guild ID');
  if (!config.userId) {
    toast('User ID required if mods-only admin is enabled.');
  }
  const minutesInput = document.getElementById('idleMinutes');
  const minutes = Number(minutesInput?.value || 0);
  await apiRequest(config, '/api/v1/admin/idle-timeout', {
    method: 'POST',
    body: {
      guildId: config.guildId,
      userId: config.userId || undefined,
      minutes,
    },
  });
};

const bindConnectionForm = () => {
  if (!connectionForm) return;
  fillForm(connectionForm, getConfig());
  connectionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = readForm(connectionForm);
    saveConfig(data);
    toast('Connection settings saved.');
    try {
      await runHealthCheck();
    } catch (err) {
      toast(err.message || String(err));
    }
  });
};

if (testBtn) {
  testBtn.addEventListener('click', () => {
    runHealthCheck().catch((err) => toast(err.message || String(err)));
  });
}

if (refreshStatusBtn) {
  refreshStatusBtn.addEventListener('click', () => {
    refreshStatus().catch((err) => toast(err.message || String(err)));
  });
}

if (refreshLogsBtn) {
  refreshLogsBtn.addEventListener('click', () => {
    refreshLogs().catch((err) => toast(err.message || String(err)));
  });
}

if (djEnableBtn) {
  djEnableBtn.addEventListener('click', () => {
    djAction('enable')
      .then(() => toast('DJ enabled.'))
      .catch((err) => toast(err.message || String(err)));
  });
}

if (djDisableBtn) {
  djDisableBtn.addEventListener('click', () => {
    djAction('disable')
      .then(() => toast('DJ disabled.'))
      .catch((err) => toast(err.message || String(err)));
  });
}

if (idleApplyBtn) {
  idleApplyBtn.addEventListener('click', () => {
    updateIdleTimeout()
      .then(() => toast('Idle timeout updated.'))
      .catch((err) => toast(err.message || String(err)));
  });
}

bindConnectionForm();

const tick = async () => {
  try {
    const config = getConfig();
    if (!config.apiBaseUrl) {
      setHealthStatus(false, 'Missing base URL');
      return;
    }
    await runHealthCheck(config);
    if (!config.apiToken) return;
    await refreshStatus();
    await refreshLogs();
  } catch (err) {
    toast(err.message || String(err));
  }
};

void tick();
setInterval(() => void tick(), 7000);
