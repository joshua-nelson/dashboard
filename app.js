import {
  apiRequest,
  createToast,
  fillForm,
  formatTime,
  getConfig,
  healthCheck,
  readForm,
  requireField,
  saveConfig,
  setHealthStatus,
} from './shared.js';

const toast = createToast();
const connectionForm = document.getElementById('connectionForm');
const refreshBtn = document.getElementById('refreshAll');
const testBtn = document.getElementById('testHealth');
const playForm = document.getElementById('playForm');
const statusPill = document.getElementById('statusPill');

const setStatus = (status) => {
  if (!statusPill) return;
  statusPill.textContent = status;
  statusPill.classList.remove('playing', 'paused');
  if (status === 'playing') statusPill.classList.add('playing');
  if (status === 'paused') statusPill.classList.add('paused');
};

const renderQueue = (queue) => {
  const list = document.getElementById('queueList');
  if (!list) return;
  list.innerHTML = '';
  if (!queue || queue.length === 0) {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.textContent = 'Queue is empty.';
    list.appendChild(li);
    return;
  }
  queue.forEach((track, index) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `
      <p class="queue-title">${track.title || 'Untitled track'}</p>
      <div class="queue-meta">
        <span>${track.author || 'Unknown artist'}</span>
        <span>#${index + 1}</span>
      </div>
    `;
    list.appendChild(li);
  });
};

const renderHistory = (history) => {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '';
  if (!history || history.length === 0) {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.textContent = 'No recent tracks.';
    list.appendChild(li);
    return;
  }
  history.slice(0, 6).forEach((track) => {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.innerHTML = `
      <p class="queue-title">${track.title || 'Untitled track'}</p>
      <div class="queue-meta">
        <span>${track.author || 'Unknown artist'}</span>
        <span>${track.requestedBy ? `By ${track.requestedBy}` : ' '}</span>
      </div>
    `;
    list.appendChild(li);
  });
};

const renderNowPlaying = (state) => {
  const titleEl = document.getElementById('trackTitle');
  const metaEl = document.getElementById('trackMeta');
  const requesterEl = document.getElementById('trackRequester');
  const coverEl = document.getElementById('trackCover');
  const elapsedEl = document.getElementById('elapsed');
  const durationEl = document.getElementById('duration');
  const volumeEl = document.getElementById('volume');
  const progressEl = document.getElementById('progressFill');

  setStatus(state.status || 'idle');

  if (!state.current) {
    if (titleEl) titleEl.textContent = 'Nothing playing';
    if (metaEl) metaEl.textContent = 'Add a track to get started.';
    if (requesterEl) requesterEl.textContent = 'n/a';
    if (elapsedEl) elapsedEl.textContent = '0:00';
    if (durationEl) durationEl.textContent = '0:00';
    if (volumeEl) volumeEl.textContent = 'Volume n/a';
    if (progressEl) progressEl.style.width = '0%';
    if (coverEl) coverEl.src = 'https://placehold.co/220x220/0b0f14/8b96a9?text=JoshBot';
    return;
  }

  const current = state.current;
  if (titleEl) titleEl.textContent = current.title || 'Untitled track';
  if (metaEl) metaEl.textContent = current.author || 'Unknown artist';
  if (requesterEl) requesterEl.textContent = current.requestedBy || 'n/a';
  if (volumeEl) volumeEl.textContent = `Volume ${state.volume ?? 100}%`;
  if (coverEl) coverEl.src = current.artworkUrl || 'https://placehold.co/220x220/0b0f14/8b96a9?text=JoshBot';

  const lengthMs = current.length || 0;
  const positionMs = state.position || 0;
  const isLive = current.isStream || lengthMs === 0;
  if (elapsedEl) elapsedEl.textContent = isLive ? 'live' : formatTime(Math.floor(positionMs / 1000));
  if (durationEl) durationEl.textContent = isLive ? 'live' : formatTime(Math.floor(lengthMs / 1000));
  const pct = isLive ? 0 : Math.min(1, Math.max(0, positionMs / lengthMs));
  if (progressEl) progressEl.style.width = `${(pct * 100).toFixed(2)}%`;
};

const refreshState = async (config = getConfig()) => {
  requireField(config, 'guildId', 'Guild ID');
  const state = await apiRequest(config, '/api/v1/music/state', {
    query: {guildId: config.guildId},
  });
  renderNowPlaying(state);
  renderQueue(state.queue || []);
  renderHistory(state.history || []);
};

const runHealthCheck = async (config = getConfig()) => {
  try {
    await healthCheck(config);
    setHealthStatus(true, 'API online');
  } catch (err) {
    setHealthStatus(false, 'Offline');
    throw err;
  }
};

const attachControls = () => {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    try {
      const config = getConfig();
      requireField(config, 'guildId', 'Guild ID');
      await apiRequest(config, `/api/v1/music/${action}`, {
        method: 'POST',
        body: {guildId: config.guildId},
      });
      await refreshState();
    } catch (err) {
      toast(err.message || String(err));
    }
  });
};

const attachPlayForm = () => {
  if (!playForm) return;
  playForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const config = getConfig();
    try {
      requireField(config, 'guildId', 'Guild ID');
      requireField(config, 'channelId', 'Channel ID');
      const queryInput = document.getElementById('playQuery');
      const immediate = document.getElementById('playImmediate');
      const skip = document.getElementById('playSkip');
      const query = queryInput?.value.trim() ?? '';
      if (!query) throw new Error('Enter a song URL or search query.');

      await apiRequest(config, '/api/v1/music/play', {
        method: 'POST',
        body: {
          guildId: config.guildId,
          channelId: config.channelId,
          query,
          immediate: Boolean(immediate?.checked),
          skip: Boolean(skip?.checked),
          userId: config.userId || undefined,
        },
      });

      if (queryInput) queryInput.value = '';
      await refreshState();
    } catch (err) {
      toast(err.message || String(err));
    }
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

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    refreshState().catch((err) => toast(err.message || String(err)));
  });
}

if (testBtn) {
  testBtn.addEventListener('click', () => {
    runHealthCheck().catch((err) => toast(err.message || String(err)));
  });
}

bindConnectionForm();
attachControls();
attachPlayForm();

const tick = async () => {
  try {
    const config = getConfig();
    if (!config.apiBaseUrl) {
      setHealthStatus(false, 'Missing base URL');
      return;
    }
    await runHealthCheck(config);
    if (!config.apiToken || !config.guildId) return;
    await refreshState(config);
  } catch (err) {
    toast(err.message || String(err));
  }
};

void tick();
setInterval(() => void tick(), 5000);
