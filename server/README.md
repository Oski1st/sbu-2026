# OneLine server

`septa-proxy.mjs` supplies the exact `/api/transit/septa/trains` route to Vite development/preview and the production host. Record-level validation and snapshot expiry remain in Person 3’s adapter. Error bodies expose only stable error codes.

`index.mjs` serves the built app and API from the same origin. It defaults to loopback port 3000. Configure `HOST` and `PORT` for a deployment. Unknown APIs and missing assets return errors rather than the SPA shell; Journey and Wallet document links receive `index.html`.

Run `pnpm build && pnpm start` from the repository root. `pnpm test` includes proxy HTTP tests with injected upstream responses, without contacting the public API.
