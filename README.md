# JoshBot Web Dashboard

A lightweight, modern dashboard (Tailwind UI) that proxies JoshBot's REST API so you can control music playback, manage Auto-DJ, and inspect status/logs without exposing your API token to the browser.

## Features
- Health indicator and quick-refresh controls.
- Live music state (now playing, queue, status, volume) with transport buttons.
- Track queue form with immediate/skip options.
- Admin tools: status snapshot, log viewer, Auto-DJ enable/disable, and idle timeout updates.
- Server-side proxy that injects the API bearer token so it never reaches the client.

## Prerequisites
- Node.js 18+ (for the built-in Fetch API).
- JoshBot REST API reachable from this container (default `http://172.17.0.2:8081`).

## Configuration
Set the following environment variables when running the dashboard container/server:

- `API_TOKEN` (**required**): JoshBot API bearer token (e.g., `fpa0azk9ywm_XFG@wzn`).
- `API_BASE_URL` (optional): Base URL for the JoshBot API. Defaults to `http://172.17.0.2:8081`.
- `PORT` (optional): Port for the dashboard web server. Defaults to `3000`.
- `NODE_ENV` (optional): Set to `development` for verbose proxy error logging.

## Running locally
1. Install dependencies (none are required beyond Node 18+, but `npm install` will create `node_modules` if you add packages later):
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   API_TOKEN="<your-token>" API_BASE_URL="http://172.17.0.2:8081" npm start
   ```
3. Open the dashboard at [http://localhost:3000](http://localhost:3000).

## Scripts
- `npm start` – start the production server.
- `npm run dev` – start the server with `NODE_ENV=development` for extra logging.
- `npm test` – syntax check for `server.js`.

## Notes
- All browser requests are sent to `/api/*` endpoints on this server, which then forward to the JoshBot REST API with the configured bearer token.
- If you need to customize the UI, edit `public/index.html` and `public/app.js`; no build step is required because Tailwind is loaded from the CDN.
