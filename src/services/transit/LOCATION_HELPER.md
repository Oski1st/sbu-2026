# Optional location suggestion contract

This helper is called only by a user’s **Use my location** click in a secure
context. Importing it, rendering Search or mounting a component does not request
location. Search integration belongs to its assigned owner and is not included here.
All checks use synthetic/mock positions; no real device permission is requested.

## H1–H6 disposition and compatibility

| Finding | Follow-up contract |
| --- | --- |
| H1 timing | `timeoutMs` remains the browser acquisition option (default10,000ms). A distinct `waitLimitMs` application timer (default30,000ms) returns `request-expired`, never browser `timeout`. |
| H2 points | Inputs are eligible qualified catalogue representative points, which can be Census internal points or operator-stop representatives. No downtown/centre claim. `distanceReference` identifies that reference explicitly. |
| H3 stale requests | Optional `AbortSignal` returns `cancelled`; timer/listener cleanup and late success/error suppression apply to every settled request. Caller checks request identity and signal again before applying an awaited result. |
| H4 labels | `state` is now required on each place and returned with ID/name. Display it, including ambiguous same-name places. |
| H5 minimization | Returned coordinates are removed. There is no opt-in coordinate return because this caller needs only the proposed place ID and distance/uncertainty. |
| H6 validation/ties | Blank or padded IDs/names, invalid/padded state codes and duplicate IDs fail before geolocation. Exact distance ties use stable codepoint ID order, independent of input order/locale, and are marked uncertain. |

This corrects the isolated PR16 contract. Required changes for a future caller:
provide state, stop reading `result.coordinates`, use representative-point wording,
and handle two new error codes `request-expired` / `cancelled`. `timeoutMs` no longer
controls the app timer. The default browser acquisition budget remains10s; default
app wait is30s. Durations must be positive integer milliseconds≤2,147,483,647.
Existing distance/uncertainty/default50km logic, explicit confirmation and privacy
assertions are retained. No existing app consumer imports the helper on this branch.

## Timing and cancellation limits

The [W3C acquisition timeout definition](https://www.w3.org/TR/geolocation/#timeout-member)
excludes permission and document-visibility waiting. This module does not query
permission state or observe when either waiting phase ends. The10s browser option
therefore does not mean a result must arrive10s after the click. A mock callback at
12s can succeed before the independent30s app limit. If the browser reports code3,
`timeout` means it could not acquire a position within its acquisition limit.

`request-expired` means only that the app stopped waiting. Permission or position
acquisition may still be pending; their separate elapsed times are unknown. JavaScript
timers can be delayed by a paused/throttled event loop, so this is not a hard real-time
guarantee. Manual entry is visible throughout, independent of any timer.

Aborting, expiring or settling clears the app timer and abort listener and ignores
all later provider callbacks without reading their coordinates. `getCurrentPosition`
has no cancellation method here: this does **not** dismiss a browser/OS prompt,
revoke permission or stop its provider. Retry only on another explicit user action;
abort a previous request on edits/navigation/unmount/replacement and clear its displayed
suggestion. Do not start repeated requests automatically or treat retry as a cleanup API.

## Input eligibility and caller outline

The helper owns no city catalogue and must not receive an unfiltered audit list.
Only qualified searchable supported entries with non-null finite representative
points feed matching. A catalogue adapter is responsible for eligibility, sources,
coverage qualifications and canonical market choices; directory membership does not
establish train service, operating carrier, a direct route or current tickets.

For the separately reviewed catalogue contract, the caller should start with
`verifiedMarketChoices` (canonical qualified choices), **not** whole `nationalCities`.
This outline is documentation only; neither that catalogue nor Search is imported
or edited by this isolated helper change:

```ts
import { requestCurrentLocation } from './services/transit/location';
import type { LocationCity } from './services/transit/location';

// verifiedMarketChoices is supplied by the catalogue adapter, with its qualifications.
const supported: LocationCity[] = verifiedMarketChoices.flatMap(city => {
  if (city.auditStatus !== 'verified' || city.coordinateMethod === 'unavailable' ||
      typeof city.latitude !== 'number' || typeof city.longitude !== 'number' ||
      !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) return [];
  return [{ id: city.id, name: city.name, state: city.state,
    latitude: city.latitude, longitude: city.longitude }];
});
let active: AbortController | undefined;

async function onUseMyLocationClick() {
  active?.abort();
  const request = new AbortController();
  active = request;
  // Keep the manual input visible and usable during this wait.
  const result = await requestCurrentLocation(supported, { signal: request.signal });
  if (request.signal.aborted || active !== request) return;
  showLocationOutcome(result); // Show state, qualifications, distance and confirmation.
  // Do not setOrigin here. Origin changes only after explicit user confirmation.
}
function onManualEditOrLeave() {
  active?.abort();
  active = undefined;
  clearLocationSuggestion();
}
```

A malformed supplied catalogue still returns `invalid-catalogue` without requesting
permission; invalid rows are not silently assigned coordinates or nearby cities.
No local catalogue copy is maintained beyond a per-request snapshot of its inputs.
State is a trimmed two-uppercase-letter code; the caller owns supported-state eligibility.

## Result, distance and errors

Success has `status='suggestion'`, `nearestCity={id,name,state}`, `distanceKm`,
`distanceReference='catalogue-representative-point'`, `uncertaintyKm` and `proximity`.
Display **“Approximate straight-line distance to [place, state]’s catalogue
representative point; not a route or guaranteed downtown/boarding location.”** A
place can contain the rider yet have a faraway internal point. This helper does not
calculate municipality containment, distance to a city boundary or nearest station.

Matching uses coordinates rounded internally to0.01° and great-circle distance.
Uncertainty is the browser accuracy radius plus up to0.8km rounding, rounded upward
to0.1km. It is not a guarantee and does not bound errors in a representative point.
The default50km threshold applies to that point: uncertainty crossing it, or a competing
place within twice the uncertainty, yields `uncertain`; entirely outside yields
`faraway`. Neither may be silently selected. `nearby` also always requires confirmation.
Exact ties return one deterministic candidate, explicitly uncertain, not unique proof.

Every outcome has `requiresConfirmation=true` and `manualEntryAvailable=true`.
Errors have `status='error'`, a fixed sanitized message and one of:

- `unsupported`: no available browser geolocation API.
- `permission-denied`: browser code1 or synchronous SecurityError.
- `timeout`: browser acquisition code3, distinct from app elapsed waiting.
- `request-expired`: app stopped waiting; permission/acquisition phase unknown.
- `cancelled`: caller aborted; stale callbacks are discarded.
- `unavailable`: provider failure, malformed position/accuracy or invalid options.
- `invalid-catalogue`: missing/invalid eligible points or identity fields.

No result selects or writes an origin. Keep manual entry and editing available
while loading and after every success/error. Never serialize this result into a URL.
The actual rider position, even rounded, is not returned or needed by the caller.
Raw/rounded positions remain transient, with no storage, network, logging, cookies,
history or URL writes. The permissioned browser/OS provider may use its own services;
this helper cannot control that provider and makes no third-party calls itself.

## Validation

Run `pnpm test` and `pnpm build` (TypeScript+Vite). Mock-only regressions preserve
original privacy/confirmation/geometry/error cases and add separate wait/acquisition
semantics, pre/in-flight aborts, late callbacks, all timer/listener cleanup paths,
representative points/state labels, deterministic ties, validation and50km boundaries.
Browser permission UI, OS provider behavior and integrated Search remain untested.

Handoff checks: locked install passed; **101/101 tests in7 files**, including
**56/56 helper tests** (28 original cases retained with documented contract corrections,
28 additional cases), and TypeScript/Vite build passed. The helper remains unimported
by application consumers. Source review confirms no network/storage/URL/logging path.
