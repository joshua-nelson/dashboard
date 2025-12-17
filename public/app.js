const healthStatus = document.getElementById('healthStatus');
const healthDot = document.getElementById('healthDot');
const stateBadge = document.getElementById('stateBadge');
const currentTitle = document.getElementById('currentTitle');
const currentMeta = document.getElementById('currentMeta');
const positionEl = document.getElementById('position');
const volumeEl = document.getElementById('volume');
const queueEl = document.getElementById('queue');
const guildEl = document.getElementById('guildId');
const statusList = document.getElementById('statusList');
const logsEl = document.getElementById('logs');
const toastEl = document.getElementById('toast');

let toastTimeout;

const controlButtons = document.querySelectorAll('.control-btn');

const showToast = (message, tone = 'info') => {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastEl.classList.remove('border-emerald-400/40', 'border-rose-400/40', 'border-amber-400/40');

  if (tone === 'success') {
    toastEl.classList.add('border-emerald-400/40');
  } else if (tone === 'error') {
    toastEl.classList.add('border-rose-400/40');
  } else if (tone === 'warn') {
    toastEl.classList.add('border-amber-400/40');
  }

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.add('hidden'), 3200);
};

const fetchJson = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { error: text || 'Request failed' };
  }
  if (!response.ok) {
    const message = data?.error || response.statusText;
    throw new Error(message);
  }
  return data;
};

const formatMs = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const setHealth = (ok, message) => {
  healthStatus.textContent = message;
  healthDot.classList.remove('bg-emerald-400', 'bg-rose-500', 'bg-amber-400');
  healthDot.classList.add(ok ? 'bg-emerald-400' : 'bg-rose-500');
};

const updateStateView = (state) => {
  const status = state?.status || 'idle';
  stateBadge.textContent = status.toUpperCase();
  const statusClasses = {
    playing: 'bg-emerald-500/20 text-emerald-100',
    paused: 'bg-amber-500/20 text-amber-100',
    idle: 'bg-slate-700/60 text-slate-100',
  };
  stateBadge.className = `rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[status] || 'bg-slate-700/60 text-slate-100'}`;

  if (state.current) {
    currentTitle.textContent = state.current.title || 'Unknown track';
    currentMeta.textContent = [state.current.author, state.current.uri].filter(Boolean).join(' • ') || '—';
  } else {
    currentTitle.textContent = 'Nothing playing';
    currentMeta.textContent = '—';
  }

  const length = state.current?.length || 0;
  positionEl.lastElementChild.textContent = `${formatMs(state.position)} / ${formatMs(length)}`;
  volumeEl.lastElementChild.textContent = `Volume ${state.volume ?? 100}%`;

  if (Array.isArray(state.queue) && state.queue.length) {
    queueEl.innerHTML = '';
    state.queue.forEach((track, idx) => {
      const item = document.createElement('li');
      item.className = 'rounded-lg border border-white/5 bg-white/5 px-3 py-2';
      item.innerHTML = `<div class="flex items-center justify-between"><div><p class="font-semibold text-sm">${track.title || 'Untitled'}</p><p class="text-xs text-slate-400">${track.author || 'Unknown artist'}</p></div><span class="text-xs text-slate-400">#${idx + 1}</span></div>`;
      queueEl.appendChild(item);
    });
  } else {
    queueEl.innerHTML = '<li class="text-slate-400">No queued tracks.</li>';
  }
};

const fetchHealth = async () => {
  try {
    const data = await fetchJson('/api/health');
    setHealth(true, 'Healthy');
    guildEl.textContent = data?.guildId ? `Guild ${data.guildId}` : 'Connected';
  } catch (err) {
    setHealth(false, err.message || 'Offline');
    showToast(err.message || 'Health check failed', 'error');
  }
};

const fetchState = async () => {
  try {
    const state = await fetchJson('/api/music/state');
    updateStateView(state);
  } catch (err) {
    showToast(err.message || 'Failed to load state', 'error');
  }
};

const fetchStatus = async () => {
  try {
    const data = await fetchJson('/api/admin/status');
    statusList.innerHTML = '';
    Object.entries(data || {}).forEach(([key, value]) => {
      const item = document.createElement('div');
      item.className = 'rounded-lg border border-white/10 bg-white/5 px-3 py-2';
      const label = document.createElement('dt');
      label.className = 'text-xs uppercase tracking-wide text-slate-400';
      label.textContent = key;
      const val = document.createElement('dd');
      val.className = 'text-sm font-semibold text-white';
      val.textContent = typeof value === 'string' ? value : JSON.stringify(value);
      item.append(label, val);
      statusList.appendChild(item);
    });
  } catch (err) {
    statusList.innerHTML = '<p class="text-sm text-rose-300">Failed to load status.</p>';
    showToast(err.message || 'Failed to load status', 'error');
  }
};

const fetchLogs = async () => {
  const limit = Number(document.getElementById('logLimit').value || 50);
  try {
    const data = await fetchJson(`/api/admin/logs?limit=${Math.max(1, Math.min(500, limit))}`);
    if (Array.isArray(data)) {
      logsEl.textContent = data
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry?.ts || entry?.timestamp) {
            const time = entry.ts || entry.timestamp;
            return `[${time}] ${entry.level || ''} ${entry.message || ''}`.trim();
          }
          return JSON.stringify(entry);
        })
        .join('\n');
    } else {
      logsEl.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  } catch (err) {
    logsEl.textContent = 'Failed to load logs.';
    showToast(err.message || 'Failed to load logs', 'error');
  }
};

const postControl = async (endpoint, successMessage) => {
  try {
    await fetchJson(`/api/music/${endpoint}`, { method: 'POST' });
    showToast(successMessage, 'success');
    fetchState();
  } catch (err) {
    showToast(err.message || 'Action failed', 'error');
  }
};

const queueTrack = async (event) => {
  event.preventDefault();
  const userId = document.getElementById('userId').value.trim();
  const query = document.getElementById('query').value.trim();
  const immediate = document.getElementById('immediate').checked;
  const skip = document.getElementById('skipCurrent').checked;

  if (!userId || !query) {
    showToast('User ID and query are required', 'warn');
    return;
  }

  try {
    await fetchJson('/api/music/play', {
      method: 'POST',
      body: JSON.stringify({ userId, query, immediate, skip }),
    });
    showToast('Track queued', 'success');
    fetchState();
  } catch (err) {
    showToast(err.message || 'Failed to queue track', 'error');
  }
};

const enableDj = async () => {
  const userId = document.getElementById('djUserId').value.trim();
  if (!userId) {
    showToast('DJ user ID is required', 'warn');
    return;
  }
  const channelId = document.getElementById('djChannelId').value.trim();
  const seed = document.getElementById('djSeed').value.trim();
  try {
    await fetchJson('/api/admin/dj/enable', {
      method: 'POST',
      body: JSON.stringify({ userId, channelId: channelId || undefined, seed: seed || undefined }),
    });
    showToast('Auto-DJ enabled', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to enable DJ', 'error');
  }
};

const disableDj = async () => {
  try {
    await fetchJson('/api/admin/dj/disable', { method: 'POST' });
    showToast('Auto-DJ disabled', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to disable DJ', 'error');
  }
};

const updateIdleTimeout = async () => {
  const minutes = Number(document.getElementById('idleMinutes').value || 0);
  const userId = document.getElementById('djUserId').value.trim() || document.getElementById('userId').value.trim();
  if (!Number.isFinite(minutes) || minutes < 0) {
    showToast('Minutes must be zero or greater', 'warn');
    return;
  }
  if (!userId) {
    showToast('User ID is required for audit logging', 'warn');
    return;
  }
  try {
    await fetchJson('/api/admin/idle-timeout', {
      method: 'POST',
      body: JSON.stringify({ minutes, userId }),
    });
    showToast('Idle timeout updated', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to update timeout', 'error');
  }
};

const wireEvents = () => {
  document.getElementById('playForm').addEventListener('submit', queueTrack);
  document.getElementById('refreshState').addEventListener('click', fetchState);
  document.getElementById('refreshStatus').addEventListener('click', fetchStatus);
  document.getElementById('refreshLogs').addEventListener('click', fetchLogs);
  document.getElementById('refreshAll').addEventListener('click', () => {
    fetchHealth();
    fetchState();
    fetchStatus();
    fetchLogs();
  });
  document.getElementById('enableDj').addEventListener('click', enableDj);
  document.getElementById('disableDj').addEventListener('click', disableDj);
  document.getElementById('updateIdle').addEventListener('click', updateIdleTimeout);

  controlButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const messages = {
        pause: 'Playback paused',
        resume: 'Playback resumed',
        skip: 'Track skipped',
        stop: 'Playback stopped',
      };
      postControl(action, messages[action] || 'Action completed');
    });
  });
};

const bootstrap = () => {
  wireEvents();
  fetchHealth();
  fetchState();
  fetchStatus();
  fetchLogs();
  setInterval(fetchState, 5000);
};

document.addEventListener('DOMContentLoaded', bootstrap);
