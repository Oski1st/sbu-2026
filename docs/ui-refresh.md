# UI refresh (Hybrid B+A)

Branch `feat/ui-refresh`, based on release candidate 1 (`2d0b5ef`). Visual only: routes,
copy, data, search/journey logic, rail-map geometry, the location combobox DOM/roles,
the native Compare `<dialog>` and native date/time inputs are unchanged.

## What changed

- **Theme** — daisyUI 5 with one custom light theme, `oneline` (forest `#173f35` primary,
  `#234f3e` secondary, lime `#d7ef95` accent, paper `#f8f9f3` base, ink neutral). No other
  themes, no dark mode. Only the daisyUI pieces in use are emitted (`button`, `badge`, base
  colours). `.hero` is not generated because the Search page owns that class.
  Refresh rules live in `src/styles/{theme,layout,search,journey}.css` and the end of
  `src/components/wallet/wallet.css`, loaded after `index.css` so teammates' edits to
  `index.css` merge cleanly.
- **Header/footer** — full-width forest bar, lime active pill; footer text ≥11px at 6:1.
- **Search** — 30px times and 34px fares (tabular numerals), stat-style duration/transfer
  chip, pill operator badges (same accessible colour-mix text), forest primary buttons,
  forest filter chips, lighter Compare dialog. Tiny 7–10px grey text raised to ≥10px, ≥4.5:1.
- **Journey** — theme tokens instead of slate/emerald; ordered list of segments with
  numbered step markers on a dashed rail (lime = current demo step, amber = simulated
  delay); larger times; daisyUI `btn`/`badge`.
- **Toast** — shadcn Sonner: pressing *Simulate delay* also shows a short “Delay simulation on”
  toast (RC3-UI: worded differently so #41's live region stays the single full
  “Simulated delay” announcement); *Reset simulation*, the demo *Reset* and a trip change dismiss it;
  no motion under `prefers-reduced-motion`.
- **Tooltip** — shadcn/Radix tooltip on the icon-only swap and clear-comparison buttons,
  lazily loaded. Not on the Compare dialog close button (a portalled tooltip would sit
  under the native modal's top layer).
- **Wallet** — ticket-stub cards (forest header band, perforated fine print), forest
  progress bar. **No tabs:** the page has no peer sections — the SEPTA snapshot exists
  only for SEPTA trips, and hiding the checklist or snapshot behind a tab would hide
  required disclaimers.

## Accessibility measurements

Focus indicators (computed in Chromium by tabbing through Search, Journey and Wallet;
ring colour vs the surrounding surface):

| Indicator | Before | After |
| --- | --- | --- |
| Global outline | `#7da24b` on white 2.94:1 | forest `#173f35` 3px: 11.67:1 white, 11.03:1 paper, 11.33:1 `#fbfcf8` |
| Location input underline | `#97b47e` 2.30:1 | forest underline + 3px forest outline, 11.67:1 |
| Header nav / brand | forest on forest bar n/a | lime ring on forest 9.27:1 |
| Skip link | — | lime ring framed by 6px forest, 9.27:1 each side |
| Wallet | `#ad5b00` 4.91:1 | forest 11.67:1 |
| Journey Tailwind rings | slate-950 | `ring-primary` + white offset, 11.67:1 |

The native date/time calendar-picker button (inside the input's shadow DOM) still uses
Chromium's own focus ring; that control is owned by the search-focus-date fix.

Key text pairs: lime on forest 9.27:1; paper on forest 11.03:1; header nav `#dbe7d6` on
track ≈7.0:1; `#c9dccb` header note on forest 8.11:1; sage `#55675b` on white 6.04:1 / paper
5.70:1 / `#eef1e6` 5.28:1; toast paper on `#1b2a24` 14.14:1 (description `#d6e2d3` 11.17:1);
delay marker `#3d2a00` on `#f3c552` 8.45:1; Wallet status `#704d0a` on `#fff1d8` 6.83:1;
operator badges unchanged (e.g. SEPTA `#0e568d` on `#e9f3fb` 6.83:1).

## Bundle (gzip)

| Asset | Before | After |
| --- | --- | --- |
| Main JS | 135.18 kB | 135.58 kB |
| Main CSS | 14.81 kB | 18.16 kB |
| Journey JS (lazy, includes sonner) | 6.59 kB | 16.22 kB |
| Journey CSS (lazy) | — | 0.61 kB |
| Wallet CSS (lazy) | 1.40 kB | 1.95 kB |
| Tooltip chunk (lazy, Radix) | — | 28.59 kB |

## Screenshots

`docs/ui-refresh/before/` and `docs/ui-refresh/after/`: Search, Journey
(`/journey/regional-connection` with the delay simulated) and Wallet
(`/wallet/regional-connection`) at 1280, 390 and 320 px. No horizontal overflow at any
width. (Playwright full-page captures can paint the off-screen skip link or the fixed toast
mid-page; that is a capture artefact, present in the before set too.)
