# Deploying OneLine

OneLine is a static React build plus a small Node server (`server/index.mjs`). The server serves `dist/`, the SPA deep-link fallback, and the same-origin SEPTA proxy (`GET /api/transit/septa/trains`) from one origin. It uses only Node built-ins, so `pnpm start` adds no runtime dependency.

**Status (October 24, 2026):** rehearsed from a clean checkout of `main` at `5efcd3b` (Search, Compare, Journey, Wallet and the SEPTA proxy) with Node 22.23.4, pnpm 11.25.0 and `HOST=0.0.0.0 PORT=8080 NODE_ENV=production`. All 6 checks in `qa/smoke.mjs` passed over the laptop's LAN address, including a live SEPTA response. **No hosted deployment exists yet.** Going live needs a team member to connect the repository to a host account on a free tier. Nobody should start a paid service for the demo.

## Requirements

- A Node-capable host with a long-running process. A static-only host is not enough (see below).
- Node.js **22.12+** (`engines.node`).
- pnpm **11.25**. Run `corepack enable` and the `packageManager` field selects the version.
- Outbound HTTPS to `api.septa.org` for live data. Without it the Wallet shows its "Live data unavailable" state, and everything else still works.
- No API keys, secrets or `.env` files.

## Build and start

| Setting | Value |
| --- | --- |
| Install + build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start` |
| Environment | `HOST=0.0.0.0` and `PORT` (usually injected by the host) |
| Health check path | `/` (200). `/api/transit/septa/trains` depends on SEPTA, so don't use it as a health check. |

`pnpm build` runs `tsc -b` and `vite build`, which are devDependencies. With pnpm 11.25 the build succeeded even with `NODE_ENV=production` set. If a host prunes devDependencies before the build, use `pnpm install --frozen-lockfile --prod=false`.

`dist/` must exist before `pnpm start`. The server does not build anything. Without `dist/`, page requests return `500 {"error":"server_unavailable"}`.

## HOST and PORT

| Variable | Default | On a host |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Set it to **`0.0.0.0`**. With the default, the server accepts loopback connections only and the host's router can't reach it. |
| `PORT` | `3000` | Leave it to the host if the platform injects it. Otherwise set it to the port the platform routes to. |

The server logs `OneLine listening at http://<HOST>:<PORT>` once it is ready.

## SPA deep links

The app uses `BrowserRouter`, so these real paths must load `index.html` on a fresh request or refresh:

- `/`, `/search`
- `/journey`, `/journey/:tripId` (for example `/journey/regional-connection`)
- `/wallet`, `/wallet/:tripId` (for example `/wallet/amtrak-connection`)
- Legacy `?trip=<id>` links, which redirect client-side to the canonical path
- Any unknown path, which shows the in-app "A little off the line" page

`server/index.mjs` already handles this. A request with no file extension that sends `Accept: text/html` gets `index.html`. Missing assets (`/assets/x.js`) and unknown `/api/*` paths stay **404**, so a broken deploy fails loudly instead of returning HTML.

If you put a CDN or reverse proxy in front, forward all paths to Node and don't add your own SPA rewrite. Respect `Cache-Control: no-store` on `/api/*`.

### Why static-only hosting is not enough

Uploading `dist/` alone to a static host (GitHub Pages, an S3 bucket, a plain Netlify/Vercel static site):

- Refreshing `/journey/:id` or `/wallet/:id` returns 404 unless you configure a rewrite to `/index.html`.
- Even with that rewrite, `/api/transit/septa/trains` does not exist, so the Wallet can only show "Live data unavailable".

That is an acceptable emergency fallback, but it is not the target deployment.

## Host notes (no accounts created)

Any platform that runs `pnpm start` with Node 22 and injects `PORT` works. Examples include Render web services, Railway, Fly.io and Koyeb. Pick a **free** tier, point it at `main`, and use the build/start commands above. Free tiers often sleep when idle, so open the URL about 2 minutes before the demo to wake it.

Teammates on the same network can also use a local fallback:

```sh
pnpm install --frozen-lockfile && pnpm build
HOST=0.0.0.0 PORT=3000 pnpm start   # then open http://<laptop-ip>:3000
```

## After every deploy

```sh
node qa/smoke.mjs https://<your-deployment>
```

This checks the home page and both deep-link routes, the unknown-route fallback, that a missing asset returns 404, and that the SEPTA proxy answers. A proxy answer is 200 when live, or 502/504 when SEPTA is unavailable; both are acceptable, and it must be `no-store`. Then click through Search → Journey → Wallet once in a phone-sized browser.

## Rollback

Redeploy the previous green commit from `main`; the platform's "redeploy previous" works too. There is no database or stored state to migrate. Trip selection lives in each visitor's `localStorage`.
