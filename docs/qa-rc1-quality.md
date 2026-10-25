# RC1 quality audit — performance, page quality, robustness, security headers

Base: `feat/release-candidate-1` @ `2d0b5ef7fa8bce374adaa72abf6bd522c097772b` (#39). Branch: `fix/rc1-quality`.
Measured on 2026-10-25 against `PORT=4189 node server/index.mjs` (production build, loopback), Lighthouse 12 with
the local Playwright Chromium (headless), default mobile throttling (Slow 4G, 4x CPU) and `--preset=desktop`.

## Before / after

| Page | Profile | Perf | FCP | LCP | TBT | CLS | Transfer |
|---|---|---|---|---|---|---|---|
| `/` | mobile | 86 → **99** | 3.2 s → 1.6 s | 3.3 s → 1.6 s | 10 → 20 ms | 0 → 0 | 470 → **124 KiB** |
| `/` | desktop | 100 → 100 | 0.6 s → 0.4 s | 0.7 s → 0.4 s | 0 → 0 ms | 0 → 0 | 470 → 124 KiB |
| `/journey/regional-connection` | mobile | 72 → **99** | 3.4 s → 1.6 s | 3.5 s → 1.7 s | 0 → 0 ms | **0.239 → 0** | 493 → 130 KiB |
| `/journey/regional-connection` | desktop | 93 → 100 | 0.6 s → 0.4 s | 0.6 s → 0.4 s | 0 → 0 ms | **0.152 → 0** | 493 → 130 KiB |
| `/wallet/amtrak-connection` | mobile | 71 → **99** | 3.4 s → 1.6 s | 3.5 s → 1.7 s | 10 → 0 ms | **0.239 → 0** | 486 → 130 KiB |
| `/wallet/amtrak-connection` | desktop | 93 → 100 | 0.7 s → 0.4 s | 0.7 s → 0.4 s | 0 → 0 ms | **0.152 → 0** | 486 → 130 KiB |

Accessibility 96, Best Practices 100, SEO 100 on every page before and after (see "Not changed").

Slow-3G-style CDP profile (400 ms RTT, 400 kbit/s) cold load of `/journey/regional-connection` until the Wallet
link renders: **11.6 s / 493 KiB → 4.1 s / 129 KiB**.

Main JS `index-*.js` is still 413 KB raw; on the wire it is now 111 KB (brotli 11) instead of 412 KB (the server
sent everything uncompressed). CSS 67.7 KB → ~12 KB brotli.

## Fixes

1. **No compression (biggest item).** `server/index.mjs` now serves brotli (quality 11) or gzip per
   `Accept-Encoding` for html/js/css/svg/json/txt over 1 KB, with `Vary: Accept-Encoding` and `Content-Length`.
   Compressed bodies are produced on the libuv pool, cached by content hash (a rebuilt `dist/` is never served
   stale) and pre-warmed after `listen`. Lighthouse "Enable text compression" (322–338 KiB savings) is gone.
2. **Caching.** Files under `dist/assets/` (Vite content-hashed) get `public, max-age=31536000, immutable`;
   `index.html`, SPA deep links and `robots.txt` keep `no-cache`. The SPA fallback is never given the long cache.
3. **CLS 0.239 / 0.152 on Journey and Wallet deep links.** The lazy page's `Suspense` fallback was short, so the
   footer was painted in the viewport and then pushed down. The fallback now reserves `min-height: 100vh`
   (`src/components/layout/AppLayout.tsx`). CLS is 0 on every audited page.
4. **Blank screen when a page chunk fails to load** (offline after load, or an open tab after a redeploy deletes
   old hashed chunks). Before: Journey → Wallet while offline rendered an empty `<body>` (no header, nav or
   footer). Now `RouteErrorBoundary` keeps the shell and shows "This page didn't load. Check your connection,
   then try again." with **Try again** (full reload, because `React.lazy` caches a failed import) and **Return to
   search**. Navigating elsewhere clears the error. Verified: offline → message; back online + Try again →
   Wallet renders; nav to Search works.
5. **HTTP 500 JSON for an over-long deep link.** `/wallet/<2000 chars>` hit `ENAMETOOLONG` and returned
   `{"error":"server_unavailable"}` 500. It now gets the SPA (which shows "Journey not found").
6. **404 page title.** Unknown paths were titled "OneLine · A better way there"; now "OneLine · Page not found"
   (`src/components/layout/NotFoundPage.tsx`, same copy and link home as before).
7. **Security headers** on every static response: `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=()`, and
   `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
   Verified in Chromium on `/`, Journey, both Wallets, 404 and `/journey/bogus`: zero CSP violations, the
   same-origin SEPTA proxy request succeeds, zero third-party requests, inline SVG favicon allowed.
   `'unsafe-inline'` for **styles only** is required: `JourneyPage.tsx` renders an inline `<style>` keyframe
   block (blocked with `style-src 'self'`); a hash would break on every teammate edit. Scripts stay `'self'`.
   Clipboard (Share button) is not restricted.
8. **Page metadata.** `index.html` gains Open Graph (`og:type`, `og:site_name`, `og:title`, `og:description`)
   and Twitter `summary` card text tags (no images; there is no local social image), plus a `<noscript>`
   message. `public/robots.txt` allows all. Already present and kept: `lang="en"`, viewport, theme-color,
   meta description, Person 5's inline SVG favicon, per-route titles.
9. Tests: `server/index.test.mjs` (4 tests) covers cache headers, br/gzip negotiation incl. `q=0`, security
   headers and the long-deep-link fallback. `server/README.md` documents the headers.

## Robustness probes (after)

| Probe | Result |
|---|---|
| SEPTA proxy failures (`qa/septa-proxy-outage.mjs`) | 5/5 PASS (502/502/502/504/200, `no-store`) |
| SEPTA proxy 8 s slow, then 504 | Wallet renders in < 1 s; ends with "SEPTA observations unavailable. Try Refresh feed or check SEPTA directly." |
| Offline after load, in-app navigation to an unloaded page | Recoverable message (was blank page) |
| Offline, back to a loaded page | Works |
| Offline hard reload | Browser offline page (no service worker; expected) |
| Deep links: `%3Cscript%3E`, 2000-char id, extra segment, query+hash, bad `%` in query, `//evil.example/path` | All render a page, no horizontal overflow (2000-char id was 500) |
| `/journey/..%2f..%2fetc` | JSON 404 by the existing dot-segment guard (intended) |
| 240-char city names typed into both fields at 320 px | No page-level horizontal overflow |
| 30 rapid header-nav clicks, 8 rapid "select route" clicks | Lands on the Journey, no errors |
| 25× back/forward spam + 10× back | One `<main>`, coherent heading and title |

## Not changed (and why)

- **Lazy-loading the rail map geometry.** After compression every audited page scores 99–100 with TBT ≤ 20 ms
  and the map is in the Search hero (above the fold), so a dynamic import would add a request waterfall and
  CLS risk on the home page for little gain; it is also Search-owned code. Remaining Lighthouse "unused
  JavaScript" estimate is ~136–153 KiB raw on Journey/Wallet (the eagerly imported Search page + map). If
  wanted later: make `SearchPage` lazy in `App.tsx`, or lazy-load `CorridorMap` with a fixed-height placeholder.
- **Colour contrast (Lighthouse a11y 96).** Many small muted labels are 2.8–4.4:1 (e.g. footer `#8e9a84` on
  `#f8f9f3` 2.79:1, `.aside-signoff` 2.89:1, route-card metadata ~3.0–3.3:1). These live in `src/index.css`,
  which others are editing; owner/design decision.
- **`label-content-name-mismatch`:** `SearchPage.tsx:516` `<a href="#main-content" aria-label="Back to search">`
  has visible text not included in its accessible name. Search-owned; one-line fix for its owner.
- **Web app manifest / service worker.** Not trivial to do well (needs PNG icons, offline caching strategy);
  skipped. Offline hard reload therefore shows the browser's offline page.
- **Security headers on JSON responses** (`sendJson` in `septa-proxy.mjs`) only carry `nosniff` + `no-store`;
  that is enough for JSON. `Strict-Transport-Security` is left to Render's TLS edge.
- Vite already emits `modulepreload` for the main chunk; no extra preload needed.
