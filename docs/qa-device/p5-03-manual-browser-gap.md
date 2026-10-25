# P5-03 — Native-browser coverage and remaining manual gaps

Person 5 · docs only · no application code changed. P5-02 (`p5-02-search-candidate.md`) is kept unchanged as historical evidence for the same SHA.

## Target

| Item | Value |
| --- | --- |
| Application target (tested) | `dad01cf86b64ac8f92794345913e067b21edcc74` (PR #29 head, `feat/search-integration`; base #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3`) |
| QA document commit | Recorded in the draft QA PR (#35) and the DONE report. It is separate from the application target. |
| Where it ran | Local `pnpm dev` on the tester's Mac, `http://127.0.0.1:5174`. **Local candidate, not deployed.** |
| Host | macOS 26.6 (25G83), Apple Silicon · Node v22.23.4 · pnpm 11.25.0 |

## How each browser was exercised

| Browser | Version | Method | Limits |
| --- | --- | --- | --- |
| Google Chrome (installed app) | 156.0.8078.47 | The installed Chrome app, driven by Playwright 1.64.1 (`channel: 'chrome'`, visible window). Keyboard and mouse events go through Chrome's own input pipeline into the native date/time controls and the autocomplete. | Automated input, **not a human tester**. The 200% zoom row is a device-scale emulation (a 640×400 CSS viewport at scale factor 2), **not** browser zoom. See C11. |
| Safari | 26.6.2 | Real-Safari automation through `safaridriver` (W3C WebDriver) was attempted. | **BLOCKED.** Safari refused to start a session: *"You must enable 'Allow remote automation' in the Developer section of Safari Settings."* The tester chose not to enable it, and the agent does not change browser security settings. No manual Safari pass was done. |

## Results — Google Chrome 156 (native input)

Known findings carried over from P5-02 are marked **known**. They reproduce here; they are not new regressions.

| # | Check | Steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Keyboard autocomplete | From: select all, type `new`, press ↓ ↓ then Enter | Options listed; ↓ moves the highlight; Enter picks | Options "New Haven CT" and "New York NY"; `aria-activedescendant=origin-option-new-york`; value "New York"; list closes | PASS | — |
| C2 | No match + Escape | Type `Zzyzx`, then press Escape | Visible no-match message; Escape closes the list and focus stays | The "No supported sample cities match “Zzyzx”…" message is visible; `aria-expanded=false`; focus stays on From | PASS | — |
| C3 | Pointer autocomplete | To: type `was`, then click the first suggestion | The clicked city fills the field | Clicked "Washington, DC"; the field reads "Washington, DC"; the list closes | PASS | — |
| C4 | Tab / Shift+Tab | Click the page, press Tab 22 times, then Shift+Tab 4 times | Logical order, no trap | Order: From → Swap → To → Date → Time → Find my way → region cards → "See all 24 cities" → Sort → filters. Shift+Tab reverses. No trap. | PASS | — |
| C5 | Form focus visibility | Keyboard-focus To (Tab from Swap) | A clearly visible indicator with at least 3:1 contrast | Only the 1px `#97b47e` underline appears (2.3:1 on white); Date/Time show a 2px `#97b47e` outline | FAIL (**known**: P5-02 F1) | `screenshots/p5-03-chrome156-focus-destination-keyboard.png` |
| C6 | Typed calendar date | Click the Date month segment, type `12252026`, click Find my way, press Back | The typed date is accepted and saved in the URL; Back restores the earlier date | Typed value 2026-12-25 → URL `/?date=2026-12-25&time=17%3A30` → Back shows 2026-11-15 | PASS | — |
| C7 | Typed time only: Back / Forward / refresh | Click the Time hour segment, type `0945AM`, submit, then Back, Forward, reload | Only the time changes; every navigation restores the matching value | Typed 09:45 → URL `time=09%3A45` → Back shows 17:30 → Forward shows 09:45 → reload shows 09:45 with the date still 2026-11-15 | PASS | — |
| C8 | 375 px date field | Chrome window viewport at 375×812, Planning preference | The full date is visible | The fields are side by side, the date field is 129px, and the year shows as "11/15/202…" | FAIL (**known**: P5-02 F2) | `screenshots/p5-03-chrome156-date-time-375.png` |
| C9 | 390 px date field | Viewport at 390×844 | The full date is visible | "11/15/2026" fully visible, tight against the icon | PASS (marginal) | `screenshots/p5-03-chrome156-date-time-390.png` |
| C10 | Journey → Wallet → back | Click "Choose this route" → Start demo journey → Next step → View ticket wallet → Back → Back | Each page loads; returns to Search with its preferences | `/journey/regional-connection`; status "Current step: transfer at Trenton Transit Center…"; `/wallet/regional-connection`; Back → Journey; Back → `/?date=2026-11-15&time=17%3A30` with the date and time intact | PASS | — |
| C11 | Real 200% browser zoom | Cmd+Plus to 200% on Search, Journey and Wallet | No sideways scrolling or clipped text | **BLOCKED for automation.** Browser zoom shortcuts cannot be sent from page automation, and OS-level key injection would need a macOS Accessibility permission that was not granted. Supplementary emulation (640×400 CSS at scale 2): no horizontal overflow on any of the three pages. That is **not** counted as a real-zoom pass. | BLOCKED | `screenshots/p5-03-chrome156-zoom200eq-{search,journey,wallet}.png` (emulation only) |

Minor observation: the suggestion text reads "Washington, DC DC" to anything reading the text content, because the city name already contains "DC" and the state label repeats it. It looks fine visually; a screen reader may repeat "DC".

## Results — hardware, screen reader, motion, Safari

| # | Row | Result | Exact block / evidence |
| --- | --- | --- | --- |
| S1 | Safari 26.6.2: every check in C1–C11 | BLOCKED | Remote automation is not enabled (exact error quoted above). No human Safari pass was run. |
| P1 | Real phone | BLOCKED | No phone was available for this session. The server stayed bound to 127.0.0.1; no tunnel or network change was made. |
| V1 | VoiceOver | BLOCKED | No human screen-reader session was run. DOM/ARIA inspection is not counted. |
| M1 | OS Reduce Motion at runtime | BLOCKED | The macOS setting was not changed. P5-02 #19 covers the code only. |

## Totals (P5-03)

| | PASS | FAIL | BLOCKED | NOT TESTED |
| --- | --- | --- | --- | --- |
| Chrome 156 (C1–C11) | 8 | 2 (both known) | 1 | 0 |
| Safari / phone / VoiceOver / motion | 0 | 0 | 4 | 0 |
| **Total** | **8** | **2** | **5** | **0** |

No new regressions were found. The two failures are the P5-02 findings F1 (focus contrast) and F2 (375px date clipping), now confirmed in installed Chrome.

---

## Human checklists for the remaining gaps

Shared setup, for any tester with repo access on a Mac:
```bash
cd sbu-2026 && git fetch origin && git switch --detach dad01cf86b64ac8f92794345913e067b21edcc74
corepack enable && pnpm install --frozen-lockfile && pnpm dev
```
Open the printed URL followed by `/?date=2026-11-15&time=17%3A30`. Record the device, OS and browser versions, and PASS, FAIL or BLOCKED for each step. Keep screenshots free of personal data.

### H1 — Safari 26 manual pass (desktop)
1. Turn on Safari → Settings → Advanced → "Press Tab to highlight each item on a webpage" (or use Option+Tab).
2. From: select all, type `new`, press ↓ ↓ then Enter → expect "New York". Type `Zzyzx` → expect the no-match message; press Escape and the list closes.
3. To: type `was` and **click** "Washington, DC" → the field fills.
4. Tab through the form. Is a focus indicator clearly visible on From, To, Date and Time? (Known F1: a faint underline.) Is there any trap?
5. Click the Date field, type `12/25/2026`, click Find my way, then press Back → expect 11/15/2026.
6. Change only the Time to `09:45 AM`, submit, then Back (expect 5:30 PM), Forward (expect 9:45 AM), and Cmd+R (expect 9:45 AM).
7. Press Cmd+Plus until the zoom reaches 200%. Check Search, Journey (Choose this route) and Wallet (View ticket wallet) for sideways scrolling or clipped text. Press Cmd+0 to reset.
8. Develop → Enter Responsive Design Mode → 375 width → is the date year clipped? (Known F2.)
9. Journey: Start demo journey → Next step → View ticket wallet → Back → Back → Search keeps 11/15/2026 and 5:30 PM.

### H2 — Real 200% zoom in Google Chrome
1. In Chrome, press Cmd+Plus until the zoom bubble shows 200%.
2. Check Search, then Choose this route (Journey), then View ticket wallet (Wallet): no horizontal scrollbar and no cut-off text or buttons.
3. Press Cmd+0.

### H3 — Real phone (same trusted Wi-Fi, no tunnel)
1. On the Mac, stop the server and run `pnpm dev --host 0.0.0.0`. If macOS asks to allow incoming connections, that decision belongs to the device owner; declining means BLOCKED.
2. Find the Mac's LAN address (System Settings → Wi-Fi → Details). On the phone, open `http://<that-address>:5173/?date=2026-11-15&time=17%3A30`, or the port Vite prints. Don't record the address in evidence.
3. Check that the Date and Time fields are fully visible, then tap each to use the native picker.
4. Autocomplete: type `new` and tap "New York".
5. Tap Find my way → Choose this route → Start demo journey → Next step → View ticket wallet → Back → Back. Do the preferences survive?
6. Rotate the phone and confirm there is no sideways scrolling.
7. Stop the server with Ctrl+C when done.

### H4 — VoiceOver (macOS, Safari)
1. Press Cmd+F5 to start VoiceOver. Navigate with VO (Ctrl+Option) + arrows.
2. From: expect "From, combo box" (or similar). Type `new` → hear the available-cities announcement. Press ↓ and each option is read.
3. Type `Zzyzx` → the no-match status is announced.
4. Activate Find my way → the results count ("… sample connection(s) …") is announced.
5. Journey: Start demo journey and Next step → the "Current step: …" status is announced.
6. Wallet: the leg headings and checklist are read sensibly. Press Cmd+F5 to stop.

### H5 — Runtime reduced motion
1. Turn on System Settings → Accessibility → Display → **Reduce motion**.
2. Reload Search, choose a route, and open Journey and Wallet. There should be no slide or fade entrance and no smooth scrolling.
3. Turn Reduce motion back off afterwards if that is the owner's preference.
