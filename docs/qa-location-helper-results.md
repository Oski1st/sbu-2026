# Location helper QA (P4-22)

Owner: Person 4. Assigned in hub issue #2 as **P4-22**. Target: optional PR #16, `feat/location-helper` → `main`.

This is a **standalone helper and data-contract audit**. It isn't integrated Search, combined #26 or production. Only injected or mock geolocation and synthetic or catalogue fixture coordinates were used; this machine's real location and browser permission were never requested.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`b2b9353c5dab623e26a220729eca7b581f335799`** (PR #16 head, open). Merge base with `main`: `db454c030040a07c00986117331f172acf5848f6`. |
| Diff | 2 files: `src/services/transit/location.ts` (156 lines) and `location.test.ts` (150 lines). Nothing else in `src/` imports the helper, and it isn't in the built bundle. |
| Environment | Node 22.23.4, pnpm 11.25.0, vitest 3.2.7. Run on October 24, 2026 (US Eastern). |

## Checks run

| Check | Command | Result |
| --- | --- | --- |
| Locked install | `pnpm install --frozen-lockfile` | Pass |
| Build (`tsc -b` + Vite) | `pnpm build` | Pass. The branch has no separate `typecheck` script; `tsc -b` is the type check. |
| Unit tests | `pnpm test` | **73 / 73**, including the PR's **28** location tests |
| Source trace | review plus `grep` for network, storage, cookie, URL, history, console, IndexedDB and import paths | **None** in `location.ts`. The module has no imports at all. |
| Independent checks | `P4_22=1 P4_22_CATALOGUE=<P4-19 dump> pnpm exec vitest run qa/p4-22-location.test.ts` | **24 / 24** behave as described below. Several encode findings as observed behaviour. Without `P4_22` the spec is skipped (73 passed, 24 skipped). |

The catalogue fixture is the P4-19 runtime dump of PR #20 at `d45b0d3` (1,550 entries, 1,370 verified), regenerated offline with `qa/p4-19-catalogue-dump.test.ts`. No catalogue data was changed.

## Behaviour verified (`qa/p4-22-location.test.ts`)

| # | Area | Observed |
| --- | --- | --- |
| L1 | Import | Importing reads no `navigator` property and creates no timer or fetch, so there's no request at import or construction |
| L2 | Explicit call | One call makes exactly one `getCurrentPosition` with `{ enableHighAccuracy: false, maximumAge: 0, timeout: 10000 }`, and never `watchPosition` (no tracking) |
| L3 | Permission time | **Finding H1.** The 10 s watchdog starts before the permission prompt. A user who approves after 12 s gets `timeout`, and the granted position is discarded. |
| L4 | Late and duplicate callbacks | A second success or a later error after settling is ignored, so the first result stands. 0 timers remain after success or error. |
| L5 | Cancellation | **Finding H3.** There's no cancel input: an aborted `signal` option is ignored and the request still resolves |
| L6 | Malformed positions | NaN, ±Infinity, lat 90.0001, lon −180.0001, accuracy NaN, Infinity, −1 or null, string lat, and null lat all give `unavailable` with no coordinates in the result |
| L7 | Exact edges | lat ±90, lon ±180 and accuracy 0 are accepted |
| L8 | Default 50 km boundary | With accuracy 200 m, `uncertaintyKm` = 1.0. At 48.9 km → `nearby`, 49.1 → `uncertain`, 50.9 → `uncertain`, 51.1 → `faraway`. A custom `maxDistanceKm` of 100 is honoured (98.9 → `nearby`). The boundary is inclusive: `nearby` while distance + uncertainty ≤ max. |
| L9 | Ties | For two equidistant places, catalogue order picks the ID, and the result is always `uncertain`. Finding H6. |
| L10 | Zero, one or many places | Empty → `invalid-catalogue` before any location request. One place → never ambiguous. Many → nearest by great-circle distance. |
| L11 | Catalogue validation | A whitespace-only `id` or `name` (`" "`) is accepted. Finding H6. |
| L12 | Privacy | Success and error paths call no `fetch`, `XMLHttpRequest`, `sendBeacon`, storage `setItem`, `document.cookie`, `history.push` / `replaceState`, `location.assign` / `replace` / `href` or `console.*`. The raw digits (40.123456789) never appear in results; only coordinates rounded to 0.01° are returned. A provider error message is never passed through. |
| L13 | Rounding bound | The worst half-cell displacement on a latitude grid is below 0.8 km, so the code comment's bound holds |
| L14 | Catalogue fixture | The verified list (1,370) is accepted, and a position at Philadelphia's point gives `philadelphia`. The full audit list (1,550) is **rejected whole** as `invalid-catalogue`, because 10 rows have `null` coordinates. At Portland OR the result is `{ id: "portland-or", name: "Portland" }`, a name only. Findings H2 and H4. |

The PR's own tests also cover browser error codes 1, 2, 3 and 99, server or unsupported contexts, synchronous provider exceptions including `SecurityError`, retry after failure, invalid options and input snapshotting. I re-ran them (28 / 28) but didn't duplicate them.

## Verdict

- **Privacy: pass for the helper itself.** There's no persistence, URL, network, analytics or logging path in the source, and the L12 checks confirm it at runtime. Raw coordinates stay inside the callback, and only 0.01°-rounded coordinates are returned. What happens to those after return is the caller's responsibility (see H5 and the obligations below).
- **Consent: pass.** There's no request on import, the call is explicit, and every suggestion has `requiresConfirmation: true` and `manualEntryAvailable: true`. The helper never selects an origin.
- **Boundary: pass**, as documented. The 50 km default, the uncertainty band, `faraway` and `uncertain` all behave as written, and ties and ambiguity are flagged `uncertain`.
- **Errors: pass, with H1.** Denied, unavailable, unsupported, timeout and malformed input all resolve to a manual-entry error, and late callbacks are ignored. But the watchdog also times out users who are slow to answer the permission prompt.

## Findings

| # | Severity | Owner (for later routing) | Finding | Reproduce | Suggested action |
| --- | --- | --- | --- | --- | --- |
| H1 | **Medium**: user-visible error | Helper owner (P3 per coordinator) | The helper's own `setTimeout` watchdog starts before `getCurrentPosition` and so includes the time the permission prompt is open. The W3C Geolocation `timeout` option deliberately excludes permission time. A first-time user who takes longer than 10 s to answer gets "Location took too long", and the position they just allowed is discarded. | `qa/p4-22-location.test.ts` L3 | Make the watchdog a generous outer safety net (for example 60 s) and rely on the browser `timeout` for acquisition, or check permission state first. Document the behaviour either way. |
| H2 | **Medium**: integration contract mismatch | Helper owner and the integrator | The helper requires "representative city-centre coordinates" and suggests the UI say "distance to city centre". The likely catalogue (PR #20) explicitly provides Census internal points and operator-stop representatives that are **not** downtown centres. Passing the full `nationalCities` list fails as a whole (`invalid-catalogue`, 10 `null` rows). | L14; PR #20 README "not guaranteed downtown centres" | Change the wording to "distance to the place's representative point (straight line)". Callers must pass `verifiedNationalCities` (or another null-free list), not the audit list. |
| H3 | Low | Caller (documented in the helper) | There's no cancellation input (`AbortSignal`). An obsolete request still resolves, and the browser lookup continues until it settles or the watchdog fires. | L5 | The caller must track request identity and ignore stale results after edits, navigation or repeated clicks. An optional `signal` would make this harder to get wrong. |
| H4 | Low | Caller | `nearestCity` is `{ id, name }` only. Same-name places (Portland ME / OR; 206 shared unqualified aliases in the PR #20 catalogue) display ambiguously. | L14 | The caller shows the state by looking up `id`. The helper could also return the state if the catalogue has it. |
| H5 | Low: data minimisation | Helper owner | The result returns rounded coordinates (0.01°, about 1.1 km), which the documented UI (city, distance, uncertainty) doesn't need. They're still personal location data if a caller stores, logs or puts them in URLs. | L12 | Drop `coordinates` from the result or coarsen it. Until then, the caller keeps it transient only. |
| H6 | Info | Helper owner | Ties are decided by catalogue order, though they're always flagged `uncertain`. Whitespace-only IDs and names pass validation. | L9, L11 | Trim and validate strings; optionally break ties by ID. |

None of these blocks the helper as an isolated, optional module. H1 and H2 should be settled before any Search integration.

## Caller and UI obligations (not guaranteed by the helper)

1. Call it only from the explicit "Use my location" action, never on render or mount. Serve over HTTPS; production already uses HTTPS.
2. Pass a null-free, unique-ID catalogue of searchable places only (for example `verifiedNationalCities`), with honest labels for representative points.
3. Never auto-select. Ask for confirmation for every proximity state, including `nearby`, and keep manual origin entry visible in every state.
4. Discard stale results (request token) after origin edits, navigation or repeated clicks. Disable or debounce the button while a request is pending.
5. Keep `coordinates` transient. Never persist, log, send or add them to URLs; pass only the chosen city ID onward.
6. Show the state for same-name places, and describe distances as straight-line, approximate, and not a route or a statement about service.
7. Handle `invalid-catalogue` and all error codes with the manual-entry message.

## Not tested

- Real browsers, devices or permission UI.
- The OS or browser location provider.
- Search integration (there's none on this branch).
- Production.
