'use strict';

const { createServer } = require('node:http');
const { readFile, stat } = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const API_BASE_URL = process.env.API_BASE_URL || 'http://172.17.0.2:8081';
const API_TOKEN = process.env.API_TOKEN;
const PORT = Number(process.env.PORT || 3000);
const isDev = process.env.NODE_ENV === 'development';

if (!API_TOKEN) {
  console.error('Missing API_TOKEN. Set it to the JoshBot REST API bearer token.');
  process.exit(1);
}

const publicDir = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const sendText = (res, status, body, contentType = 'text/plain; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
};

const getRequestBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const proxyRequest = async (targetPath, { method = 'GET', body, headers = {}, search } = {}) => {
  const url = new URL(targetPath, API_BASE_URL);
  if (search) {
    url.search = search;
  }

  const requestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      ...headers,
    },
  };

  if (body !== undefined) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
    requestInit.headers['Content-Type'] = requestInit.headers['Content-Type'] || 'application/json; charset=utf-8';
  }

  const response = await fetch(url, requestInit);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({})) : await response.text();

  return { status: response.status, payload, isJson };
};

const handleApi = async (req, res, url) => {
  try {
    const { pathname, search } = url;
    const method = req.method || 'GET';

    if (pathname === '/api/health' && method === 'GET') {
      const result = await proxyRequest('/health');
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/music/state' && method === 'GET') {
      const result = await proxyRequest('/api/v1/music/state');
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/music/play' && method === 'POST') {
      const raw = await getRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await proxyRequest('/api/v1/music/play', { method: 'POST', body });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/music/pause' && method === 'POST') {
      const result = await proxyRequest('/api/v1/music/pause', { method: 'POST' });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/music/resume' && method === 'POST') {
      const result = await proxyRequest('/api/v1/music/resume', { method: 'POST' });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/music/skip' && method === 'POST') {
      const result = await proxyRequest('/api/v1/music/skip', { method: 'POST' });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/music/stop' && method === 'POST') {
      const result = await proxyRequest('/api/v1/music/stop', { method: 'POST' });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/admin/status' && method === 'GET') {
      const result = await proxyRequest('/api/v1/admin/status');
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/admin/logs' && method === 'GET') {
      const limit = new URLSearchParams(search || '').get('limit');
      const searchParams = limit ? `?limit=${encodeURIComponent(limit)}` : search || '';
      const result = await proxyRequest('/api/v1/admin/logs', { search: searchParams });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/admin/dj/enable' && method === 'POST') {
      const raw = await getRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await proxyRequest('/api/v1/admin/dj/enable', { method: 'POST', body });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/admin/dj/disable' && method === 'POST') {
      const result = await proxyRequest('/api/v1/admin/dj/disable', { method: 'POST' });
      return sendJson(res, result.status, result.payload);
    }

    if (pathname === '/api/admin/idle-timeout' && method === 'POST') {
      const raw = await getRequestBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await proxyRequest('/api/v1/admin/idle-timeout', { method: 'POST', body });
      return sendJson(res, result.status, result.payload);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    if (isDev) {
      console.error('API proxy error', err);
    }
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};

const serveStatic = async (res, filePath) => {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT' && isDev) {
      console.error('Static file error', err);
    }
    return false;
  }
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url);
  }

  const relativePath = decodeURIComponent(url.pathname).replace(/\\/g, '/');
  let requestedPath = path.join(publicDir, relativePath);

  if (!requestedPath.startsWith(publicDir)) {
    return sendText(res, 403, 'Forbidden');
  }

  let served = await serveStatic(res, requestedPath);

  if (!served && !relativePath.endsWith('/')) {
    requestedPath = path.join(publicDir, `${relativePath}.html`);
    served = await serveStatic(res, requestedPath);
  }

  if (!served) {
    const fallback = path.join(publicDir, 'index.html');
    await serveStatic(res, fallback) || sendText(res, 404, 'Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard listening on http://0.0.0.0:${PORT}`);
  console.log(`Proxying JoshBot API at ${API_BASE_URL}`);
});
