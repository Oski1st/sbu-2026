# RC3-UI — RC3 plus the oneline redesign

Branch `feat/release-candidate-3-ui` starts at `feat/release-candidate-3`
(see `release-notes-rc3.md`) and cherry-picks (`-x`) the 9 `feat/ui-refresh`
commits `2d0b5ef..1479ea65d4bf5704137993ab89f250b9726baa5e` in order. Then come
two integration commits. Not merged, not deployed.

## Stable patch IDs

| original | picked | patch-id original | patch-id picked | result | subject |
|---|---|---|---|---|---|
| 33d845a | 52fd8e8 | 916825f75f24 | 916825f75f24 | match | feat(ui): daisyUI 5 oneline theme, cn() helper, focus ring |
| 1be15fc | abba7d9 | 83e015810748 | fb8fabbe1c3a | differs (conflict) | feat(ui): forest header bar with lime active pill; readable footer |
| c7868dc | 4535c2a | d17dcb588451 | d17dcb588451 | match | feat(ui): restyle Search |
| 139ef98 | 8da307d | 71c50d615708 | 82ce951015a7 | differs (conflict) | feat(ui): shadcn Tooltip on icon-only Search controls |
| 7b82aee | 99ac654 | dce015630126 | 082a5dfa5706 | differs (conflict) | feat(ui): Journey in the oneline theme with a stepped timeline |
| 57e9985 | 93f7a6e | f5ccefc0e5e6 | 0c55369b9c5e | differs (conflict) | feat(ui): Sonner toast on Journey |
| 7fac025 | bf2d054 | d99a85e0d15c | d99a85e0d15c | match | feat(ui): Wallet ticket-stub cards |
| b221d12 | c68af65 | c7eeaf6a821f | c7eeaf6a821f | match | fix(ui): skip-link ring and full location-input focus outline |
| 1479ea6 | 74fe7ef | ba289c96d2ea | ba289c96d2ea | match | docs: UI refresh summary, screenshots, README UI credits |
| (integration) | 3d4a6d2 | - | be9e34af4c7e | n/a | fix(ui): theme RC3-only Journey pieces, 3px focus on ticket links |
| (integration) | 9f1ff82 | - | b090274b9a2e | n/a | fix(ui): keep #41's single delay announcement alongside the toast |

`package.json`, `pnpm-lock.yaml`, `index.css` and `README.md` merged
automatically. The lockfile did not need regenerating, and
`pnpm install --frozen-lockfile` passes.

## Conflicts and resolutions

Rule used: keep each fix's behaviour and copy, adopt the redesign's palette
and layout, and keep #45's explicit 3px focus outlines (`#4f7a2f` on light
surfaces; lime `#d7ef95` inset `-5px` on dark `bg-primary` controls) instead of
the redesign's 2px `ring-primary`.

- **AppLayout (1be15fc)**: took the new `site-header-bar` wrapper. The header
  note stays "Prototype · sample trips" (copy-humanize), not "Less switching.
  More going.". W2's footer, without the GitHub link, is unchanged.
- **SearchForm (139ef98)**: kept W3/D1's `todayInNewYork` import and
  `MAX_DATE`, and added `IconTooltip`.
- **Journey (7b82aee)**, in 5 files:
  - `DelaySimulation`: W16 + copy-humanize wording and the constant-driven
    minutes, with redesign colours. The active toggle uses `bg-primary` with the
    lime inset outline.
  - `JourneyDemoControls`: copy-humanize text, #41's refs for focus restore,
    and the redesign palette with #45 outlines.
  - `SegmentCard`: kept the #28 responsive arrival alignment, the "Leg N"
    label, the coach-corridor disclosure and the new-tab sr-only text, with
    redesign colours.
  - `TransferAssistant`: kept #41's tight/missed/comfortable assessment and its
    demo-estimate disclaimer, mapped onto the redesign palette.
  - `JourneyPage`: daisyUI `btn btn-primary` with the lime #45 outline. Kept
    the disclosure "Fixed sample itinerary times (Eastern Time) · your search
    date and time are not applied".
- **Sonner (57e9985)**: kept W16's `hasConnection` prop together with the
  toast handler.
- **Integration 3d4a6d2**: themed #41's `SimulationFeedback` and the coach
  note, which still used slate. Gave the redesigned "Get tickets" link the 3px
  outline, which the `journeyWalletFocus` test requires.
- **Integration 9f1ff82** (P4-41 F6 failed 16 checks before this fix): the
  toast repeated "Simulated delay: +12 min" in Sonner's polite live region, so
  the delay was announced twice. The demo Reset also left the toast up after
  the simulation was off. The toast now reads "Delay simulation on" (+N min on
  the line · demo, not a live alert) and is dismissed on every reset and trip
  change. #41's region stays the single full announcement. `docs/ui-refresh.md`
  was updated to match.

## Checks (local, 2026-10-25, Node 22.23.4 / pnpm 11.25.0, `PORT=4198`)

| Check | Exit | Result |
| --- | --- | --- |
| Frozen install / typecheck / build | 0/0/0 | pass |
| Unit tests | 0 | 29 files, 189/189 |
| `qa/e2e-check.cjs` | 1 | 120/122, only the 2 known closed-map-details false fails (390/320) |
| `qa/smoke.mjs` | 0 | 6/6 |
| `qa/septa-proxy-outage.mjs` | 0 | 5/5 |
| P4-25 Search (adapted as in RC3) | 0 | 38/38 |
| P4-28 / P4-29 | 0/0 | 65/65, 16/16 |
| P4-35 focus measurement | 0 | all 6 controls 3px `#173f35` outline, 11.67:1 vs adjacent (≥3:1) |
| P4-41 Journey feedback | 0 | 127/127 (after 9f1ff82) |
| P4-42 new-tab links (base RC2, adapted as in RC3) | 0 | 34/34 |
| Cross-browser chromium desktop/phone | 1/1 | 68/71, 72/74 |
| Cross-browser firefox desktop/phone | 1/1 | 69/71, 72/74 |
| Cross-browser webkit desktop/phone | 1/1 | 70/72, 73/75 |

The cross-browser failures are the same as RC3. In every run, two checks fail
because the harness hard-codes the old `2026-10-24` default date, while W3
intentionally uses today in New York. Chromium desktop also fails one keyboard
check: headless Chromium has a native picker Tab stop inside the date/time
inputs. This also happens on RC2.

## Bundle (gzip)

- Main JS `index-hreLZHmk.js`: 415.86 kB (136.06 kB gzip). RC3 was 135.67 kB gzip.
- Main CSS `index-ThfynpwN.css`: 86.52 kB (18.33 kB gzip). RC3 was 14.89 kB gzip.
- The redesign adds a `tooltip` chunk of 84.36 kB (28.58 kB gzip).
- The Journey chunk is now 61.08 kB (17.32 kB gzip, with Sonner). RC3 was 7.66 kB gzip.

## Screenshots (`docs/rc3-ui/`)

`search-{1280,390,320}.png`, `journey-delay-{1280,390,320}.png` (full page
after the toast auto-dismisses), `journey-delay-toast-{1280,390,320}.png`
(viewport with the toast) and `wallet-{1280,390,320}.png`. The SEPTA feed was
stubbed as unavailable so no live feed data is committed. There is no
horizontal overflow on any page at any width. Reviewed by eye: nothing clipped
or overlapping.

## Known limits

Same as RC3. In addition, the toast is a second, short polite announcement
("Delay simulation on") next to #41's full message.
