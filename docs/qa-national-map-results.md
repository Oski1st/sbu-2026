# Full-US map QA results (P4-15)

Owner: Person 4. Feature owner: Person 2 (PR #22, `feat/nationwide-map` → `feat/demo-readiness`). Acceptance criteria: section **E** of [qa-nationwide-coverage-plan.md](qa-nationwide-coverage-plan.md).

These are **future-feature PR results**, kept separate from the release evidence for #21 (recorded in PR #12). Nothing here is a `main` or production result.

## Run: `7ff27bf` (P4-17, current)

Assigned in hub issue #2 as **P4-17**. Run on October 24, 2026 from a clean checkout of `7ff27bf114a25f3355790c7b17b5828ebeafe348` (`feat/nationwide-map`, #22). Ancestry verified: it contains readiness `49742e7` and the P4-15 target `74c9269`. Person 2's fix commit `7ff27bf` ("correct national map orientation and readable annotations") touches `CorridorMap.tsx` and its test, a new `mapProjection.ts` (Albers converted to SVG's downward y; north-up insets; Aleutians unwrapped across 180°), a new `buildUsOverviewMap.mjs`, the map JSON (now with a source SHA-256) and `index.css`.

| Check | Command | Result on `7ff27bf` |
| --- | --- | --- |
| Install, build, typecheck | `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck` | Pass |
| Unit tests | `pnpm test` | **73 / 73** (12 files) |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Canonical route IDs | `node qa/p4-14-check.cjs <url>` | **52 / 52** |
| Expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| Proxy outage / deploy smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| Demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |
| **National map** | `node qa/p4-15-map-check.cjs <url> <shots> src/data/usOverviewMap.json` (strengthened, see below) | **69 / 69** |
| Bundle, main JS `gzip -9` | | 144,735 bytes (raw 445,400), versus 143,276 at `74c9269` and 105,327 at readiness `49742e7` |

**Verdict: X7, X8 and X9 are resolved on `7ff27bf`.**

- **X7 orientation, resolved.** At 1280, 390 and 320px, west→east (California → … → New Jersey) and north→south (Washington above California, North Dakota above Texas, Michigan above Alabama, Maine above Florida, New York above Georgia) are both correct. Maine sits to the north-east and Florida to the south-east. The **Florida peninsula points south** (southern tip at 86% of Florida's width, i.e. the east side).
- **Alaska and Hawaii.** Alaska is north-up: the Aleutian samples sit in the southern half (mean y 538.9 against a midline of 499.0) and the north edge is mid-inset. The **Aleutian chain is continuous**: the largest horizontal gap is 5.9 of 267.3 units, so there's no wrap-around to the far east. **Hawaii runs north-west to south-east**: the westernmost islands' mean y is 458.1, above the easternmost at 526.3. Inset shapes stay inside their frames and don't overlap the contiguous states ([Alaska inset](qa-screenshots/national/p4-17-alaska-inset.png)).
- **X8 text size, resolved.** The title, subtitle and inset note moved to HTML. Desktop renders at 11–24.7px (floor 10). Phones render at 11–12px (floor 11): ALASKA / HAWAII / N 12.0px, title 12.0px, subtitle and inset note 11.0px.
- **X9 wording, resolved.** A single visible note, "Alaska and Hawaii: geographic insets, not to scale.", covers both insets. The map JSON's `projection` field says the same.
- **Unchanged and passing:** the "Geographic overview only … no nationwide connections are implied" note (≥ 11px, outside any fade); `role="img"` with a name saying it's not a route, schedule or coverage map, described by the note, with the SVG `aria-hidden`; **no focusable elements inside the map image**; no markers, lines or dashes; no territories; no page overflow; **no external network requests**; no console errors.
- Evidence: [1280px](qa-screenshots/national/p4-17-national-map-1280.png), [390px](qa-screenshots/national/p4-17-national-map-390.png), [320px](qa-screenshots/national/p4-17-national-map-320.png).

**Harness changes for P4-17** (validated with the P4-15 target `74c9269` as a control, which still fails X7 / X8 / X9, at 59 / 69):

1. "Not to scale" may come from a per-inset note **or** one visible shared note that names the inset or says "insets". The old check only read SVG text inside each inset, and the text has moved to HTML.
2. The text-size check now covers visible **HTML** map text (title, subtitle, inset note) as well as SVG text.
3. New geometry checks from `getPointAtLength` samples: Alaska north-up with the Aleutians to the south-west; Aleutian continuity (no wrap-around gap over 15% of the inset width); Hawaii running north-west to south-east; and the Florida peninsula's southern tip in its east half.
4. New check: no focusable elements inside the map image.

On the control, the new Alaska and Hawaii checks **pass**, and that's genuine: the old build's insets were already north-up, and only the contiguous US was mirrored (confirmed visually).

## Run: `74c9269` (P4-15, history)

Assigned in hub issue #2 as **P4-15**. Run on October 24, 2026 from a clean checkout of `74c926919420b106ddc1cd8888b975fd7d9eb0a6`. Ancestry verified: it contains readiness `49742e7`. The diff from `49742e7` touches four files: `CorridorMap.tsx`, `CorridorMap.test.tsx`, `src/data/usOverviewMap.json` (135,341 bytes) and `index.css`.

| Check | Command | Result on `74c9269` |
| --- | --- | --- |
| Install, build, typecheck | `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck` | Pass |
| Unit tests | `pnpm test` | **70 / 70** (12 files) |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Canonical route IDs | `node qa/p4-14-check.cjs <url>` | **52 / 52** |
| Expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| Proxy outage / deploy smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| Demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |
| **National map** | `node qa/p4-15-map-check.cjs <url> <shots> src/data/usOverviewMap.json` (new) | **50 / 54.** Fails: X7 (orientation) at all 3 widths, and X8 (desktop text size). |

### Bundle size (measured independently)

| Build | Main JS raw | Main JS gzip (`gzip -9`) |
| --- | --- | --- |
| Readiness `49742e7` | 327,049 bytes | 105,327 bytes |
| National map `74c9269` | 445,616 bytes | 143,276 bytes (**+37,949 bytes**) |

Vite's build report shows 105.86 kB → 144.11 kB gzipped (different gzip settings), consistent with Person 2's figures. This is a known bundle trade-off for bundled offline geography, not a regression claim.

### Verdict: **not ready to integrate.** The map is drawn upside down (X7).

| Area | Result |
| --- | --- |
| Data | Pass. 48 states + DC (49 contiguous entries), plus one Alaska and one Hawaii shape. Natural Earth 1:50m Admin 1 (public domain) source and Albers projection documented. No territory entries. |
| **Orientation (X7)** | **Fail at 1280 / 390 / 320px.** West-to-east order is correct (California → Colorado → Kansas → Missouri → Ohio → Pennsylvania → New Jersey), but **north and south are inverted**. Rendered centres at 1280px: Washington y = 388 vs California y = 296; North Dakota 369 vs Texas 218; Maine 371 vs Florida 193. The Florida peninsula points **up** at the top right, while the north arrow points up. Aspect ratio 1.59 (plausible for Albers), so it's a vertical mirror, not a distortion. |
| Alaska / Hawaii insets | Pass. Present, labelled "ALASKA" / "HAWAII", shapes inside their frames, no overlap with contiguous-state boxes. Alaska says "geographic inset · not to scale". **Note:** Hawaii says only "geographic inset". "Not to scale / not in true position" would match Alaska. Check the inset shapes for the same mirroring once X7 is fixed. |
| Text size (X8) | Phones pass (CSS enlarges map text at narrow widths). **Desktop 1280px fails the 10px floor:** subtitle, inset notes and "N" render at 8.5px (title and inset labels 11.6px). |
| Text placement | Pass: inside the map box, no overlaps, no page overflow |
| Disclosure | Pass. The visible note below the map (≥ 11px) says "Geographic overview only … no nationwide connections are implied", and it's outside any mask fade. |
| Accessibility | Pass. `role="img"`, `aria-label` says "not a route, schedule, or service-coverage map", `aria-describedby` points to the visible note, and the SVG is `aria-hidden`. |
| Geographic only | Pass: no dashed lines, `line` / `polyline` elements or markers |
| No territory implied | Pass |
| No external network requests | Pass at all widths |
| Page or console errors | None |

Evidence: [1280px](qa-screenshots/national/p4-15-national-map-1280.png), [390px](qa-screenshots/national/p4-15-national-map-390.png), [320px](qa-screenshots/national/p4-15-national-map-320.png).

### Changed requirements (documented, not silently dropped)

The East-Coast map assertions in `qa/p4-09-check.cjs` (10 named city markers, north-up **marker** order, Stony Brook east of New York, a city legend naming every marker, "Connections unverified" wording) are **historical requirements for the #21 release map**. They still apply to #21 and passed there (69 / 69 on `49742e7`).

For a geographic-only national overview they are **superseded** by plan section E and `qa/p4-15-map-check.cjs`:

| Old (#21 East-Coast map) | New (#22 national overview) |
| --- | --- |
| 10 city markers named (label or legend) | **No markers at all**, so no service claim is implied |
| Marker north-up order, Stony Brook east of NYC | **State-shape** geography: west→east order, north→south pairs, Maine north-east, Florida south-east |
| "Connections unverified" visible wording | "Geographic overview only … no nationwide connections are implied" visible note, plus an `aria-label` saying it's not a route / schedule / coverage map |
| Legend outside mask fade; ≥ 11px phone labels; no overlaps; no external requests | **Kept** unchanged |

On `74c9269` the historical script still passes all 32 of its non-map checks (X2 search persistence and history, X3 duration, coach guidance, guided flows, reduced motion). It stops at its map section because the East-Coast map element no longer exists, which is expected under the superseded requirements above.

### Findings

| # | Severity | Owner | Status | Finding | Reproduce | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| X7 | **High: correctness (blocked #22)** | Person 2, `usOverviewMap.json` / `CorridorMap.tsx` | **Resolved** by `7ff27bf` (verified P4-17). Was open on `74c9269`. | The contiguous US is rendered **vertically mirrored**: the northern states are at the bottom and Florida points up, under a north arrow pointing up. The projected y-coordinates need inverting (or the paths flipping) before rendering. The 70 unit tests don't check orientation; a test asserting, for example, `Washington.cy < California.cy` and `Maine.cy < Florida.cy` would catch it. | Open `/` at any width. `node qa/p4-15-map-check.cjs …` "geography recognisable". | [1280px](qa-screenshots/national/p4-15-national-map-1280.png) |
| X8 | Low: readability, desktop | Person 2, `index.css` | **Resolved** by `7ff27bf` (verified P4-17) | At 1280px the subtitle, inset notes and "N" render at 8.5px (floor 10px) | `/` at 1280px | same |
| X9 | Low: wording | Person 2 | **Resolved** by `7ff27bf` (shared "not to scale" note) | The Hawaii inset doesn't say "not to scale / not in true position", while Alaska does | `/`, Hawaii inset | same |
