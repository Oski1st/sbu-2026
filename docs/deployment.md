# Deploying OneLine

OneLine is a static React build plus a small Node server (`server/index.mjs`). The server serves `dist/`, the SPA deep-link fallback, and the same-origin SEPTA proxy (`GET /api/transit/septa/trains`) from one origin. It uses only Node built-ins, so `pnpm start` adds no runtime dependency.

**Status (October 24, 2026):** rehearsed from a clean checkout of `main` at `5efcd3b` (Search, Compare, Journey, Wallet and the SEPTA proxy), then re-run on `73635ac` with Node 22.23.4, pnpm 11.25.0 and `HOST=0.0.0.0 PORT=8080 NODE_ENV=production`. All 6 checks in `qa/smoke.mjs` passed over the laptop's LAN address, including a live SEPTA response. **No hosted deployment exists yet.** Going live needs a team member to connect the repository to a host account on a free tier. Nobody should start a paid service for the demo.

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

## Free hosting: steps that need a person

The checked-in Blueprint uses `plan: free` and Node 22. It explicitly installs devDependencies for the build. You can import it with **New → Blueprint**, or use the manual Web Service steps below. Review the plan before creation.

Status: **waiting on a person.** Connecting a host requires someone to sign in with the GitHub account that has access to `Oski1st/sbu-2026` and authorize the host's GitHub app. The repository now includes `render.yaml`, reviewed by Person 1, with a free Node service and the build/start/environment settings below. A repo owner still needs to connect the private repository and create the service. No service has been created by adding this file.

The recommended setup is a Render free web service, because it runs a long-lived Node process and injects `PORT`. Railway, Fly.io and Koyeb also work with the same build and start commands, but check that their current free allowance doesn't need billing first.

1. Sign in at <https://dashboard.render.com> with GitHub.
2. Click **New → Web Service** and connect `Oski1st/sbu-2026`. Approve Render's GitHub app for that repository when asked. This authorization step is the one only the repo owner can do.
3. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Branch | `main` |
   | Language / runtime | Node |
   | Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
   | Start command | `pnpm start` |
   | Instance type | **Free** |
   | Environment variables | `HOST=0.0.0.0` and `NODE_VERSION=22`. Leave `PORT` unset; Render injects it. |
   | Health check path | `/` |

4. **Stop if the form asks for a payment method or shows a non-free instance type.** Tell the team instead of continuing. Nobody should start a paid service for the demo.
5. Click **Create Web Service** and wait for the log line `OneLine listening at http://0.0.0.0:<PORT>`.
6. Send the `https://<service-name>.onrender.com` URL to Person 4, who runs `node qa/smoke.mjs <url>` and records the result in `docs/qa-checklist.md`.

Free services sleep after a period of no traffic, and the first request then takes about a minute. Open the URL about 2 minutes before the demo.

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

