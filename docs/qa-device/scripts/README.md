# Person 5 QA scripts

These are the helper scripts used to produce the P5-02 and P5-03 evidence. They are QA tooling only; nothing in the app imports them.

They expect the candidate to be served locally at `http://127.0.0.1:5174` (`pnpm dev`; change `BASE` in a script if Vite picks a different port). They use the repo's existing `playwright` dev dependency, so nothing new is installed.

Run them from the repo root:

| Script | What it does | Run |
| --- | --- | --- |
| `p5-browser-qa.mjs` | Opens the installed Google Chrome (or Playwright WebKit) and runs these checks: autocomplete, Tab order, focus styles, typed date/time with Back/Forward/reload, 375/390px date fields, an emulated 200% zoom, pointer autocomplete, Journey→Wallet→back | `node docs/qa-device/scripts/p5-browser-qa.mjs chrome qa-results/p5` |
| `focus-probe.mjs` | Moves keyboard focus onto From/To and records the computed focus styles, with screenshots | `node docs/qa-device/scripts/focus-probe.mjs chrome qa-results/p5` |
| `p5-safari-qa.mjs` | Runs the same checks in real Safari over WebDriver. Before using it: turn on Safari → Settings → Developer → "Allow remote automation", then run `safaridriver -p 4444` | `node docs/qa-device/scripts/p5-safari-qa.mjs qa-results/p5` |

`qa-results/` is git-ignored, so output stays local unless it is copied into `docs/qa-device/`.

Automated runs are **not** a human, screen-reader or real-phone test. The evidence files mark which is which. `docs/qa-device/results/` holds the raw JSON output behind the P5-03 Chrome table.
