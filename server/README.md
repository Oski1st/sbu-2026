# OneLine server

`septa-proxy.mjs` supplies the exact `/api/transit/septa/trains` route to Vite development/preview and the production host. Record-level validation and snapshot expiry remain in Person 3’s adapter. Error bodies expose only stable error codes.

`index.mjs` serves the built app and API from the same origin. It defaults to loopback port 3000. Configure `HOST` and `PORT` for a deployment. Unknown APIs and missing assets return errors rather than the SPA shell; Journey and Wallet document links receive `index.html`.

Static responses are brotli/gzip-compressed when the browser accepts it (cached in memory by content hash and pre-warmed at startup). Content-hashed files under `/assets/` are cached for a year (`immutable`); `index.html`, deep links and `robots.txt` use `no-cache` so a deploy is picked up immediately. Every static response carries `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and a same-origin `Content-Security-Policy` (scripts and `fetch` limited to this origin; inline styles allowed for the Journey animation; `data:` images for the inline favicon). If you add a third-party script, font, image or API, extend the policy in `securityHeaders`.

Run `pnpm build && pnpm start` from the repository root. `pnpm test` includes proxy HTTP tests with injected upstream responses, without contacting the public API.
