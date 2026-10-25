# P5-04 — Human test session package for candidate #33

Prepared by Person 5. Docs only. A **human tester** runs this and fills in the results table. Automated, emulated or ARIA-inspection results do **not** count here.

## Target

| Item | Value |
| --- | --- |
| Application target | PR #33 `fix/journey-timezone-clarity` at **`4e415429e583792f90746ee8e4c055730e090fa4`** |
| Base | PR #32 `fix/journey-details-focus` at `3f41b76ab3bf2b8b33f4b6a9369acd4b4417af23` |
| Contents | Search #29 (`dad01cf…`) plus reviewed Journey fixes #31 (ISO arrival timestamps), #32 (collapsed details hidden from focus and AT), #33 (Eastern Time label) |
| Preparation check (Person 5, macOS 26.6, Node 22.23.4, pnpm 11.25.0) | `pnpm install --frozen-lockfile` OK · `pnpm typecheck` exit 0 · `pnpm build` exit 0 · `pnpm test` 21 files / 107 tests passed |
| Prior evidence | P5-02/P5-03 results apply to #29 `dad01cf…` only. They are history, not a pass on #33. |

**Known findings.** Label these as known; they are not new regressions. **F1:** the focus indicator on From/To/Date/Time is 2.3:1 (`#97b47e`). **F2:** at about 375px the date year is clipped. Both are already assigned to Person 3 (P3-CHECKPOINT).

## Setup (once, on the tester's Mac)

```bash
git clone https://github.com/Oski1st/sbu-2026.git oneline-qa33 && cd oneline-qa33
git switch --detach 4e415429e583792f90746ee8e4c055730e090fa4
corepack enable && pnpm install --frozen-lockfile && pnpm dev
```
Open the printed URL followed by `/?date=2026-11-15&time=17%3A30`. To stop the server, press Ctrl+C. Write down: device, OS version, browser and version, and the SHA above.

## Checklists

**H1 — Safari, by hand.** Don't enable remote automation for this; it's a manual pass.
1. In Safari Settings → Advanced, turn on "Press Tab to highlight each item" (or use Option+Tab).
2. From: select all, type `new`, press ↓ ↓ then Enter → "New York". Type `Zzyzx` → the no-match message appears; press Escape and the list closes.
3. To: type `was` and **click** "Washington, DC".
4. Tab through the form: is focus visible on every control? (F1 is known.) Is there any focus trap?
5. Type the date `12/25/2026` → Find my way → Back → 11/15/2026. Change only the time to `09:45 AM` → submit → Back (5:30 PM) → Forward (9:45 AM) → Cmd+R (9:45 AM).

**H2 — Real 200% zoom** (Safari and Chrome). Press Cmd+Plus until the browser shows 200%. Check Search, then Journey (Choose this route), then Wallet (View ticket wallet): no sideways scrolling and no clipped text or buttons. Reset with Cmd+0.

**H3 — Real phone** (trusted home or office Wi-Fi only, no tunnel).
1. On the Mac, run `pnpm dev --host 0.0.0.0`. If macOS asks to allow incoming connections, the device owner decides; declining means BLOCKED.
2. On the phone, open `http://<Mac LAN address>:<port>/?date=2026-11-15&time=17%3A30`. Don't put the address in the evidence.
3. Date and Time are fully visible, and tapping each opens the native picker. Choose a new date and a new time.
4. Type `new` and tap "New York". Then Find my way → Choose this route → Start demo journey → Next step → View ticket wallet → Back → Back. Do the preferences survive?
5. Rotate the phone and check there is no sideways scrolling. Stop the server with Ctrl+C.

**H4 — VoiceOver** (macOS, Safari). Start it with Cmd+F5.
1. From is announced as a combo box. Typing `new` announces the number of available cities, and ↓ reads each option. `Zzyzx` announces the no-match status.
2. Find my way → the results count is announced.
3. Journey: Start demo journey and Next step → "Current step: …" is announced.
4. **Journey details (new in #32):** while a segment's "View trip details" is collapsed, VoiceOver and Tab must **not** reach the ticket link inside it. Expand it and the link becomes reachable. Collapse it again with focus inside, and focus returns to the toggle, not to the top of the page.
5. Wallet: the leg headings and checklist read sensibly. Stop VoiceOver with Cmd+F5.

**H5 — Reduce Motion at runtime.** Turn on System Settings → Accessibility → Display → Reduce motion. Reload Search, open a Journey (expand and collapse details) and the Wallet: no slide or fade entrances, and no smooth scrolling. Set it back afterwards if the owner prefers.

**H6 — Journey keyboard-only, new in #32/#33** (any desktop browser).
1. Open `/journey/regional-connection`. Tab through the page: a collapsed segment's "Get tickets from …" link must be **skipped**.
2. Press Enter on "View trip details": the details open and Tab now reaches the ticket link.
3. With focus on that link, press Shift+Tab back to the toggle and press Enter: it collapses, and focus stays on the toggle.
4. Start demo journey → Next step → Reset: focus stays on Reset or another sensible control, not lost to the page body.
5. Timeline times say Eastern Time (ET/EDT) clearly, and the simulated delay arrival shows its own time.

## Results (the tester fills this in)

| # | Device / OS / browser + version | Check | PASS / FAIL / BLOCKED | Steps to reproduce if FAIL | Evidence file |
| --- | --- | --- | --- | --- | --- |
| H1 | | Safari manual | NOT TESTED | | |
| H2a | | 200% zoom, Safari | NOT TESTED | | |
| H2b | | 200% zoom, Chrome | NOT TESTED | | |
| H3 | | Real phone | NOT TESTED | | |
| H4 | | VoiceOver, including details | NOT TESTED | | |
| H5 | | Reduce Motion at runtime | NOT TESTED | | |
| H6 | | Journey keyboard, #32/#33 | NOT TESTED | | |

Save screenshots as `docs/qa-device/screenshots/p5-04-<check>-<device>.png`, with no personal data, location, or LAN address.
