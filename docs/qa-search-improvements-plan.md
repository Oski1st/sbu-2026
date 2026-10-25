# Search improvements QA plan

Owner: Person 4. Feature owner: Person 1.

**Status: plan only. Nothing has been tested.** There is no assigned feature branch yet. Results go in the "SHA" and "Result" columns only after Person 1 posts the integrated feature SHA and a numbered `P4-NN` assignment in hub issue #2. Use "Pass", "Fail (Sn)" with a finding number, "Manual" or "Not run".

Baseline before these improvements (verified on combined expansion `21d77dd`, P4-09): search state already persists in the URL (`from`, `to`, `mode`, `operator`, `sort`, `amtrak`) through refresh, sharing and Back / Forward. City aliases (`NYC`, `DC`, `Philly`, `Long Island`) resolve. Unknown cities show "Choose cities from our East Coast catalogue". Cases below that touch existing behaviour are regressions; the rest are new.

## Ground rules every case inherits

- **Sample data stays sample data.** Changing the date or time must never imply live schedules, seat availability, prices or service on that day.
- **No precise location leaves the device.** Coordinates must not appear in the URL, `localStorage`, `sessionStorage`, cookies, IndexedDB, request URLs or bodies, logs or error messages. Only a supported city name may be stored.
- **Location is optional.** Every path that uses geolocation has a manual-entry equivalent that works without permission.
- **The existing demo is untouched.** `/` still shows `regional-connection` and `amtrak-connection` with the same times, and the regression suite (`qa/e2e-check.cjs`, `qa/expansion-check.cjs`, `qa/p4-09-check.cjs`) still passes.

## S1. Origin and destination suggestions

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S1.1 | Type `Bos` in **From** | A suggestion list appears containing Boston, MA. It only offers supported catalogue cities. | | |
| S1.2 | Type `new` | New Haven, CT and New York, NY both appear, in a stable, documented order | | |
| S1.3 | Type an alias: `NYC`, `DC`, `Philly`, `Long Island`, `Washington DC`, `Portland ME` | The canonical city is suggested ("New York, NY" etc.). Choosing it fills the canonical name. | | |
| S1.4 | Ambiguous `Portland` | Only Portland, ME (the only one in the catalogue). The state is shown, so no rider assumes Portland, OR. | | |
| S1.5 | Case, whitespace and punctuation (`  boston `, `WASHINGTON, D.C.`) | Same suggestions as the clean input | | |
| S1.6 | Unsupported city (`Atlantis`, `Chicago`, `Montreal`) | No invented match. A clear "not in our East Coast sample catalogue" message that names the input. Search still allowed, leading to the existing unsupported-city empty state. | | |
| S1.7 | Typo (`Bostn`, `Filadelphia`) | Either a "did you mean Boston?" style suggestion, or no match. Never silently searches a different city. | | |
| S1.8 | Very long input (500 characters) and pasted HTML / script text | Bounded, rendered as text (no HTML injection), no crash | | |
| S1.9 | Same origin and destination chosen from suggestions | The existing "Choose two different cities" validation | | |
| S1.10 | **Swap** after choosing from suggestions | The canonical names swap, and the URL updates | | |

## S2. Keyboard and mobile autocomplete

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S2.1 | Keyboard only: type, ArrowDown / ArrowUp, Enter | Moves through the options with a visible highlight. Enter selects. Focus stays in the input. | | |
| S2.2 | Escape with the list open | Closes the list without clearing the typed text. A second Escape doesn't submit or clear. | | |
| S2.3 | Tab with the list open | Leaves the field without selecting the highlighted option unexpectedly (or behaviour is documented) | | |
| S2.4 | Screen-reader semantics | WAI-ARIA combobox pattern: `role="combobox"`, `aria-expanded`, `aria-controls` → `role="listbox"`, options with `role="option"`, `aria-activedescendant` follows the highlight, and the result count is announced politely | | |
| S2.5 | No matches | Announced, for example "No catalogue cities match" | | |
| S2.6 | 320px and 390px | The list fits the viewport, isn't covered by the on-screen keyboard (scrolls into view), and has tap targets of at least 44px. No horizontal overflow. | | |
| S2.7 | Touch: tap a suggestion | Selects without triggering the field underneath (no click-through). The list closes. | | |
| S2.8 | Mobile keyboard | Reasonable `inputmode` / `autocomplete` and `enterkeyhint="search"`. The browser's own autofill dropdown doesn't stack on top of the app's list. | | |
| S2.9 | Reduced motion | The list opens without animation | | |
| S2.10 | Focus after search | Moves to the results heading (existing behaviour) and not back into the combobox | | |

## S3. Editable departure date and time

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S3.1 | The default value is explained | The default date and time are visibly labelled, for example "Sample departure · Eastern Time" | | |
| S3.2 | Change the date and time, then search | Itinerary times shift (or are re-anchored) consistently across Search cards, Compare, Journey and Wallet. Durations are unchanged. | | |
| S3.3 | **Timezone wording** | Every time says Eastern Time (ET), including when the device is set to another zone. Test with Playwright `timezoneId: "America/Los_Angeles"` and `"Europe/London"`: the displayed times must not shift with the device. | | |
| S3.4 | DST boundary: depart 2026-11-01 00:30 ET (fall back) and 2026-03-08 01:30 ET (spring forward) | No duplicated or missing hour, no NaN, and durations are still correct | | |
| S3.5 | Overnight and multi-day | Portland → Miami still shows the next-day date and "33h 30m total" from the edited departure | | |
| S3.6 | Validation: empty, malformed (`2026-13-40`, `25:61`), past date, far future (more than one year) | Clear inline message tied to the field (`aria-describedby`). Search blocked or the value clamped, as documented. No crash and no silent fallback. | | |
| S3.7 | Keyboard and screen reader | Native date and time inputs, or an accessible picker. Labels announce the timezone. | | |
| S3.8 | 320px / 390px | The date and time controls fit, and the native pickers open | | |
| S3.9 | **Sample-data wording** | Near the picker and on the results: "Times are illustrative samples. Changing the date doesn't check schedules or availability." No "available", "on time", "seats left", "live" or "book now" wording appears after a change. | | |
| S3.10 | Original demo | `/` with no date parameters shows the original 8:00 AM regional departure | | |

## S4. Refresh and share persistence of date and time

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S4.1 | Search with a custom date and time, then refresh | The same date, time and results | | |
| S4.2 | Copy the URL into a fresh browser (no storage) | The same date, time and results | | |
| S4.3 | Back / Forward across date changes | Each step restores its own date and time, as with the X2 filters | | |
| S4.4 | URL format | ISO-like, timezone-explicit or documented as ET (for example `date=2026-10-24&time=08:00`). No device-local offset leaks into the URL. | | |
| S4.5 | Malformed URL values (`date=bad`, `time=99:99`, injection attempts) | Fall back to the default with a visible note. No crash. | | |
| S4.6 | Journey and Wallet links from a dated search | Carry the date and time (if designed to). Refreshing Journey or Wallet keeps them. Trip IDs stay canonical. | | |
| S4.7 | Share button | The copied link includes the chosen date and time | | |

## S5. Location permission

Automate with Playwright `context.grantPermissions(["geolocation"])`, `context.setGeolocation(...)`, and a denied context (no grant). Simulate a timeout and an unavailable position with `page.addInitScript` overriding `navigator.geolocation.getCurrentPosition` to call the error callback with `TIMEOUT` (3) or `POSITION_UNAVAILABLE` (2), or by removing `navigator.geolocation`.

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S5.1 | No prompt on load | Location is only requested after an explicit "Use my location" action | | |
| S5.2 | **Allowed:** coordinates inside the catalogue area (for example 40.7128, −74.0060) | Suggests the nearest supported city ("Nearest sample city: New York, NY"), and the rider confirms it before it fills **From** | | |
| S5.3 | **Denied** | A clear, non-blocking message ("Location not shared. Type a city instead.") with focus in **From**. The control doesn't re-prompt in a loop. | | |
| S5.4 | **Timed out** | A message within a stated time, a retry option, and manual entry still works | | |
| S5.5 | **Unavailable**, or no geolocation API | A message, and the control is hidden or disabled with an explanation. Manual entry works. | | |
| S5.6 | Insecure context (`http://` on a LAN IP) | Explained gracefully. Browsers block geolocation off HTTPS / localhost. | | |
| S5.7 | Keyboard and screen reader | The control is a real button with a name. Status messages use `aria-live`. | | |
| S5.8 | 320px / 390px | The control and its messages fit without overflow | | |

## S6. Honest nearest-city suggestions and manual fallback

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S6.1 | Position near a catalogue city (Trenton area) | Suggests Trenton, NJ, labelled "nearest city in our sample catalogue", not "your station" | | |
| S6.2 | Position far outside coverage (Chicago 41.88, −87.63; Montréal 45.50, −73.57; mid-Atlantic ocean) | Doesn't pretend: "You're outside our East Coast sample area" plus manual entry. If a nearest city is offered, the distance is shown and it's clearly optional. | | |
| S6.3 | Position equidistant between two cities | A deterministic choice, or both are offered | | |
| S6.4 | Wording | No claim of transit stops, walking routes, live departures or "closest station". "Approximate" or "city-level" wording only. | | |
| S6.5 | Manual override | The rider can edit or replace the suggested city at any time; it is never locked | | |
| S6.6 | Accuracy shown honestly | If the browser reports low accuracy (for example 5 km or more), the copy says so, or the app falls back to manual | | |

## S7. Privacy: no precise coordinates stored or sent

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S7.1 | After an allowed location flow | `location.href` contains no latitude / longitude (check for decimal patterns like `\d{1,3}\.\d{3,}`) | | |
| S7.2 | Storage | `localStorage`, `sessionStorage`, `document.cookie` and IndexedDB contain no coordinates. Only a city ID or name, if anything. | | |
| S7.3 | Network | Record every request during the flow: no coordinates in any URL, header or body. **No third-party geocoding or IP-lookup calls** (the existing map makes no external requests). | | |
| S7.4 | Share link | The copied link has no coordinates | | |
| S7.5 | Errors and console | No coordinates in console output or error messages | | |
| S7.6 | Reload after an allowed flow | The app doesn't silently re-request location; it uses the URL's city | | |

## S8. Regression and honesty sweep

| # | Case | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| S8.1 | `qa/e2e-check.cjs`, `qa/expansion-check.cjs`, `qa/p4-09-check.cjs`, `qa/demo-rehearsal.cjs` (online and `--offline`) | All pass, apart from findings already open, which are listed | | |
| S8.2 | Live-claim scan across Search, Compare, Journey and Wallet after date / location changes | No unnegated "live", "real-time", "available", "on time", "book now" or "seats" wording. The SEPTA panel stays the only live element and stays agency-wide. | | |
| S8.3 | Ticket handoff | Still the official operator links, with no date or location appended unless the operator documents that parameter | | |
| S8.4 | Page and console errors | None | | |

## How it will be run

1. Wait for `Next instructions — Person 4 — P4-NN` in hub issue #2 with the branch, full SHA and included PRs. **Don't test an unassigned branch.**
2. Clean checkout of that SHA: `pnpm install --frozen-lockfile && pnpm build && pnpm test`, then `PORT=4173 pnpm start`.
3. Run the existing suites (S8.1), then a new `qa/search-improvements-check.cjs` written against the real selectors once the feature exists. Geolocation and timezone cases use Playwright `grantPermissions`, `setGeolocation`, `timezoneId` and an init-script stub for timeout / unavailable errors.
4. Record results against that SHA in this file and report under the task ID in hub issue #2.
