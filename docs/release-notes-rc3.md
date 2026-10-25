# RC3 — RC2 plus verified fixes and plain-language copy

Branch `feat/release-candidate-3` starts at RC2
`39de4ba0d104f53b56cdb817b03bbe63c3aa924f` and cherry-picks (`-x`, authorship
kept) the following inputs, in this order. Nothing was skipped. Not merged, not
deployed.

| # | Input branch | Tip SHA | Commits |
| --- | --- | --- | --- |
| 1 | `fix/newtab-links` | `b02d470a338d02b7c4dc6e178fc64b2c30b3fa81` | 1 |
| 2 | `fix/share-link-resilience` | `a71d5dbb828800c3d7b426565ec6b74c2d80d2bc` | 1 |
| 3 | `fix/journey-wallet-focus` | `c09073a54a8a8aa0afee444a4575f19a589e63af` | 1 |
| 4 | `fix/cross-browser` | `98c433842058f79abffe5016b3204fcad7320a7b` | 3 |
| 5 | `fix/walkthrough-findings` | `60c29484ca520c5362db401ad0529944607057f6` | 12 |
| 6 | `fix/journey-qa-feedback` (#41) | `65cea74ef3fd5f1dd5e614c25d59cf52b03f76cb` | 1 |
| 7 | `fix/rc1-quality` | `3b906677fdfa9cfa8da5d0ad52100e7317001abb` | 1 |
| 8 | `feat/copy-humanize` | `1d4caf481fc6761ab261bf6671d3394d29d1f7a7` | 9 |

Plus one integration commit (`test: align new-tab link counts with W2 footer
link removal`).

## Stable patch IDs (`git patch-id --stable`)

"differs" means the diff text changed: either a manual conflict resolution
(listed below) or a clean 3-way auto-merge whose context lines moved
(c09073a, fb711b7, a397a78 — checked with `git range-diff`: context only).

| original | picked | patch-id original | patch-id picked | result | subject |
|---|---|---|---|---|---|
| b02d470 | 1c2c4c7 | aa1b949adadf | aa1b949adadf | match | fix: announce external link behavior and clarify map extent |
| a71d5db | 2d068e6 | 5559d74ae676 | 5559d74ae676 | match | fix: harden share feedback and sweep all sample page renders |
| c09073a | 00e22bb | 937262fd38c0 | 654fcd9f161e | differs (auto-merge context) | fix: strengthen Journey and Wallet keyboard focus indicators |
| 5c4a9fb | 145060d | 8d7160b707e4 | 8d7160b707e4 | match | Let WebKit touch taps pick autocomplete suggestions (F1) |
| 5c6f0e7 | c33cc24 | c07486997d88 | c07486997d88 | match | Return focus to Compare routes button in Safari (F2) |
| 98c4338 | 8e10bd2 | 73fca26e885a | 73fca26e885a | match | Show green focus ring on date/time inputs in WebKit (F4) |
| 110e4d2 | 54ae8a9 | 8b77c6cc95d1 | 1fd8f9287f5e | differs (conflict) | Remove dead GitHub footer link for logged-out visitors (W2) |
| 4799c3b | 4af23a5 | b7117f64fb87 | b7117f64fb87 | match | Default Search date to today in New York and reject past picks (W3) |
| 4db02f0 | a2a7443 | 250fae7be908 | 250fae7be908 | match | Never submit an out-of-range Search date (D1) |
| 762824c | 390ecc2 | 7325386045c8 | 7325386045c8 | match | fix: replace stale 'being built by our team' Journey preview notice |
| 89fec21 | f53236d | 1bf2bd99d54b | 1bf2bd99d54b | match | Match Simulate delay copy to one-leg trips (W16) |
| d694466 | d54ae4a | b3656a84ddd4 | b3656a84ddd4 | match | Pad the concept-route note inside its card (W6) |
| b40ea71 | df93e2f | b70fc2f2a062 | b0e5d38815c9 | differs (conflict) | Show the state once in autocomplete options (W7) |
| 9faf4df | 9dbce80 | a8983cfe98dd | a8983cfe98dd | match | Show the unsupported-city warning only once suggestions close (W8) |
| d493bfc | 3102e2f | d9c41efe0fdd | d9c41efe0fdd | match | Reset mode and operator filters on every new search (W10) |
| c1d4f37 | 75501dd | 8e4c1a8d40df | 8e4c1a8d40df | match | Serve the app shell for malformed percent-encoded URLs (W11) |
| c462428 | 202da62 | dc7d2169cb77 | dc7d2169cb77 | match | Include visible text in the closing banner link name (W17) |
| 60c2948 | 3092d6a | 02379af256b1 | 02379af256b1 | match | Update QA check and checklist for malformed-URL app shell (W11) |
| 65cea74 | ae9f53d | bd037908b684 | de7a6670062e | differs (conflict) | fix: clarify simulated connections and retain Journey demo focus |
| 3b90667 | 77edb03 | 67b458e6efb0 | 9d785335e734 | differs (conflict) | Compress, cache and harden static responses; keep the shell on page load failures |
| 6fe07df | c6ea81b | 3247d1918df0 | 90eeab1e8c91 | differs (conflict) | copy: plainer page title, header, footer and 404 text |
| 8b8da52 | dccf999 | a968315ce526 | fc31c2de585a | differs (conflict) | copy: rewrite Search page and search components in plain language |
| 60e42e6 | 0b1b195 | 4d23f4aeb049 | 4d23f4aeb049 | match | copy: concrete route descriptions and corridor button labels |
| 197aef1 | 29b68da | 18d0f156f09f | 44f5e0546347 | differs (conflict) | copy: plainer Journey demo and delay text |
| fb711b7 | b989016 | 36e3d2511002 | cdc5ef2ea73a | differs (auto-merge context) | copy: plainer Wallet heading and journey/wallet fallback page |
| b2b93e1 | 496797c | 693581c047f1 | 36f4c14f4302 | differs (conflict) | copy: fix 320px wording issues found in screenshots |
| a397a78 | dd3d779 | bfb39f186d9a | 8e4858b7dd41 | differs (auto-merge context) | copy: footer line states non-affiliation instead of repeating the hero |
| 0d4fcf4 | 4972775 | 54fa473a2f5b | 54fa473a2f5b | match | docs: add copy-humanize checklist, sources and before/after table |
| 1d4caf4 | fe94bc0 | 1a098409af3d | 1a098409af3d | match | copy: say the express ride is 65 minutes shorter, not 65 minutes faster |
| (integration) | 49a1ec3 | - | 1cac928486b2 | n/a | test: align new-tab link counts with W2 footer link removal |

## Conflicts and resolutions

1. **W2 (110e4d2) × newtab-links, `AppLayout.tsx`** — newtab-links had added an
   "(opens in a new tab)" span to the footer GitHub link; W2 removes that link
   (dead for logged-out visitors). Took W2: footer shows plain "Built together".
2. **W7 (b40ea71) × cross-browser F1, `LocationAutocomplete.tsx` + test** — kept
   both exports: F1's `suggestionOptionHandlers` (mousedown-only cancel, WebKit
   taps) and W7's `optionStateLabel`; both test imports kept.
3. **#41 (65cea74) × #45 focus (c09073a), `JourneyDemoControls.tsx`** — kept
   #45's 3px outline focus classes and added #41's `ref`s (start/previous/next)
   for focus restore. #41's live region (`SimulationFeedback`) and W16's one-leg
   delay copy (`hasConnection`) both merged automatically and are present.
4. **rc1-quality (3b90667) × W2, `AppLayout.tsx` imports** — kept rc1-quality's
   `useLocation` and dropped the `ArrowUpRight` import (its only user, the footer
   link, is gone). `server/index.mjs` auto-merged: compression/caching/security
   headers/ENAMETOOLONG **and** W11's malformed-path → app shell (HTML 200) for
   `Accept: text/html` (400 JSON otherwise) are both present.
5. **copy 6fe07df** — `index.html`: kept rc1-quality's OG/Twitter meta and
   `<noscript>`, rewritten to the new title "OneLine · Trip planner" and the new
   plain description. `App.tsx`: kept rc1-quality's `NotFoundPage` and moved the
   plain 404 copy ("Page not found" / "There’s no OneLine page at this address.")
   into it. `AppLayout.tsx`: kept the reserved-height loading fallback with the
   new "Loading…" text; kept W2's link removal instead of the copy branch's
   "Source on GitHub" link.
6. **copy 8b8da52 × W17, `SearchPage.tsx`** — took the new "Back to search"
   closing link; its aria-label equals its visible text, so W17's label-in-name
   goal still holds.
7. **copy 197aef1 / b2b93e1 × W16, `DelaySimulation.tsx`** — kept W16's
   two-way wording in the new plain style: with a connection, "Add a simulated
   12-minute delay to the first leg to see what OneLine suggests when a
   connection is at risk."; one-leg trips keep "This trip has no connection, so
   a delay only moves your sample arrival time." Both end "This is a demo, not
   a live alert." (honesty disclosure kept).

Integration commit 49a1ec3: `newTabLinks.test.tsx` counted the footer GitHub
link that W2 removed; expected counts reduced by one and the footer now asserted
to have no new-tab link. `docs/qa-checklist.md` 404 line updated to the new copy.

## Checks (local, 2026-10-25, Node 22.23.4 / pnpm 11.25.0)

Production build served by `PORT=4198 node server/index.mjs`. P4 scripts copied
in for the run only (not committed) from `origin/feat/qa-search-plan`,
`origin/qa/p4-41-journey-feedback` and `origin/qa/rc1-cross-browser`.

| Check | Exit | Result |
| --- | --- | --- |
| Frozen install | 0 | lockfile unchanged |
| Typecheck | 0 | pass |
| Build | 0 | pass |
| Unit tests | 0 | 29 files, 189/189 |
| `qa/e2e-check.cjs` | 1 | 120/122; only the 2 known closed-map-details unnamed-link false fails at 390/320 |
| `qa/smoke.mjs` | 0 | 6/6 (SEPTA 200 observed) |
| `qa/septa-proxy-outage.mjs` | 0 | 5/5 |
| P4-25 Search | 0 | 38/38 (adapted, see below) |
| P4-28 Journey arrival | 0 | 65/65 |
| P4-29 Journey disclosure | 0 | 16/16 |
| P4-35 Search focus (measurement) | 0 | all 6 controls show a 5.05:1 indicator |
| P4-41 Journey feedback | 0 | 127/127 |
| P4-42 new-tab links (base = RC2 on :4199) | 0 | 34/34 (adapted, see below) |
| RC1 cross-browser chromium desktop/phone | 1/1 | 68/71, 72/74 |
| RC1 cross-browser firefox desktop/phone | 1/1 | 69/71, 72/74 |
| RC1 cross-browser webkit desktop/phone | 1/1 | 70/72, 73/75 |

Adaptations for intentional changes only:

- P4-25 E5 and cross-browser "date input default value reads back" / "Back again
  returns to default form" hard-code the old fixed default date `2026-10-24`.
  W3 intentionally defaults to today in New York (`2026-10-25` during the run).
  P4-25 E5 was adapted to compute today in New York (then 38/38). The two
  cross-browser checks were left unadapted and are the 2 failures in every
  engine/profile.
- P4-42 compares visible link text against the base; the base footer link
  "Built together" was removed by W2, so it is filtered from the base list.

Remaining cross-browser failure (chromium desktop only, also present on RC2):
headless Chromium gives date and time inputs a fourth Tab stop (the native picker
button inside the input). On that stop the input does not match `:focus`, so no
outline is drawn. Same result on an RC2 build. Not a regression.

## Bundle (gzip)

Main JS `index-NYwD89h0.js` 414.52 kB (135.67 kB gzip); main CSS
`index-B57xFiE_.css` 67.77 kB (14.89 kB gzip). SHA-256: JS
`6c5bb097d308c00a26164233646be5ce97db6a40250c58d1b10513bdcd8c6ab1`, CSS
`0548f9bdb4b1592941c8e4c7378db931bed1f17314b313861648ee86ef73b72e`.

## Known limits

Sample itineraries only; SEPTA is the only live feed (labelled snapshots).
The delay demo, demo journey and transfer buffer are simulated, not live
alerts. No real-device or screen-reader certification. RC1 rollback notes in
`release-notes-rc1.md` still apply. No merge or deploy has been done.
