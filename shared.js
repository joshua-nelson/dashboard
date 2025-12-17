const STORAGE_KEY = 'joshbot_web_config';

const defaultConfig = {
  apiBaseUrl: 'http://localhost:8081',
  apiToken: '',
  guildId: '',
  channelId: '',
  userId: '',
};

let currentConfig = loadConfig();

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {...defaultConfig};
    const parsed = JSON.parse(raw);
    return {...defaultConfig, ...parsed};
  } catch {
    return {...defaultConfig};
  }
}

export function getConfig() {
  return {...currentConfig};
}

export function saveConfig(next) {
  currentConfig = {...defaultConfig, ...currentConfig, ...next};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
  return getConfig();
}

export function fillForm(form, config) {
  if (!form) return;
  const fields = ['apiBaseUrl', 'apiToken', 'guildId', 'channelId', 'userId'];
  for (const name of fields) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.value = config[name] || '';
  }
}

export function readForm(form) {
  const data = {};
  const fields = ['apiBaseUrl', 'apiToken', 'guildId', 'channelId', 'userId'];
  for (const name of fields) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) data[name] = input.value.trim();
  }
  return data;
}

export function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function createToast() {
  const el = document.getElementById('toast');
  return (message) => {
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
  };
}

export async function healthCheck(config) {
  const baseUrl = normalizeBaseUrl(config.apiBaseUrl || '');
  if (!baseUrl) throw new Error('Missing API base URL.');
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error('API health check failed.');
  return true;
}

export async function apiRequest(config, path, {method = 'GET', body, query} = {}) {
  const baseUrl = normalizeBaseUrl(config.apiBaseUrl || '');
  if (!baseUrl) throw new Error('Missing API base URL.');
  if (!config.apiToken) throw new Error('Missing API token.');

  const url = new URL(baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data && data.error ? data.error : (res.statusText || 'Request failed.');
    throw new Error(message);
  }
  return data;
}

export function requireField(config, field, label) {
  if (!config[field]) throw new Error(`Missing ${label}.`);
}

export function setHealthStatus(ok, label) {
  const status = document.getElementById('healthStatus');
  const dot = document.getElementById('healthDot');
  if (!status || !dot) return;
  status.textContent = label;
  dot.style.background = ok ? 'var(--ok)' : '#4b5563';
  dot.style.boxShadow = ok ? '0 0 12px rgba(67, 215, 168, 0.5)' : '0 0 12px rgba(75, 85, 99, 0.4)';
}
