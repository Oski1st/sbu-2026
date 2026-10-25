# P4-26: catalogue + helper dependency candidate (#30)

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-26`). Data/services owner: Person 3.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`fe89f9ec5fc67bfdc779121143970684d649f143`** (PR #30 `feat/catalogue-helper-candidate` → `feat/map-routing-candidate`, open draft, frozen) |
| Base / control | **`35ed1965be9a2641fa31a2b8e1de60e7223260a3`** (combined #26) |
| Source PRs | Catalogue #27 **`e607fb940d47ac903570e29a688c0b0995339cd2`**; helper #28 **`0c8d96847e3b9d7a3895b703e37295a8fa8523d2`** |
| Environment, same for candidate and control | macOS 15.7.7, Apple M4, Node **v22.23.4**, pnpm **11.25.0**, Vite **7.3.7**, Tailwind CSS **4.3.3** (resolved from the same lockfile). `pnpm-lock.yaml` and `package.json` are byte-identical between base and candidate. Fresh checkouts and fresh `pnpm install --frozen-lockfile` for each. October 24, 2026 (US Eastern). |

## Provenance

#30 adds exactly five commits on `35ed196`. Each one's `git patch-id --stable` **equals** its source commit's, and the author name and author date are preserved.

| #30 commit | Source | Patch |
| --- | --- | --- |
| `ec45ba42d9fe4512fa33cbea00de988b710682c1` | #20 `d45b0d3305e154ac93c165af70ecfb6e8812f74b` | identical |
| `c82cbfb4c6ecf16dd9f8cac60a4f702771e61569` | #27 `fc844f72088521c4d0f0dcd3084fc2caf032dda2` | identical |
| `e15b24e16189ee22ef77a823a4f45590770236a3` | #27 `e607fb940d47ac903570e29a688c0b0995339cd2` | identical |
| `1ee33c3cfbd9c9abeba15c12cba84d94d343b787` | #16 `b2b9353c5dab623e26a220729eca7b581f335799` | identical |
| `fe89f9ec5fc67bfdc779121143970684d649f143` | #28 `0c8d96847e3b9d7a3895b703e37295a8fa8523d2` | identical |

**Scope:**
- 22 files, all **added**, and **no base file modified**: `src/data/national/**`, `src/data/nationalCities.ts` and its test, and `src/services/transit/{location.ts, location.test.ts, LOCATION_HELPER.md}`.
- Nothing outside those files imports them.

**Byte comparisons** (git blob IDs):
- All **19** catalogue files are identical to #27 `e607fb9`. That's the four frozen JSON files, `evidence/batch1.json`, the builders, the READMEs, `nationalCities.ts` and its test.
- All **3** helper files are identical to #28 `0c8d968`.
- 0 differences.

## Commands (exit codes)

| Command | Control `35ed196` | Candidate `fe89f9e` |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | 0 |
| `pnpm typecheck` | 0 | 0 |
| `pnpm build` | 0 | 0 |
| `pnpm test` | 0: **85 / 85** (16 files) | 0: **163 / 163** (19 files) |

The control build reproduces the frozen #26 assets measured in P4-18 / P4-21 exactly (`index-BL_X6Ku1.js`, `index-Cgcrj_ju.css`).

## Asset delta (uncompressed bytes)

| Asset | Control | Candidate | Content |
| --- | ---: | ---: | --- |
| main CSS | `index-Cgcrj_ju.css` 60,356 | `index-DE8_jWk7.css` **60,386** | **+30 bytes**: one added rule, `.rounded{border-radius:.25rem}` |
| main JS | `index-BL_X6Ku1.js` 447,171 | `index-C3GgoKO8.js` 447,171 | Identical once its 3 hashed asset references are normalised |
| JourneyPage JS | `JourneyPage-BaQnOAky.js` 22,047 | `JourneyPage-D1c_QBXX.js` 22,047 | Identical once 1 reference is normalised |
| WalletPage JS | `WalletPage-Ckz3Rkjv.js` 11,670 | `WalletPage-Dr73B0ff.js` 11,670 | Identical once 1 reference is normalised |
| WalletPage CSS | `WalletPage-DZXjDvwT.css` 4,455 | same name, 4,455 | Byte-identical |
| `index.html` | 604 | 604 | Identical once the hashed names are normalised |

- **Compressed:** main CSS `gzip -9` goes from 13,393 to 13,399 bytes (+6).
- **Cause, reproduced:** Tailwind v4 automatic source detection picks up the bare word "rounded" in the newly added non-UI text. It appears in `src/services/transit/location.ts` (a comment), `LOCATION_HELPER.md`, `src/data/national/README.md` and `src/data/nationalCities.test.ts`. The base `src/` has no bare "rounded" token.
- **Unused:** no `.tsx` / `.css` file uses the class, so the rule is unused. All other hash changes are knock-on effects of the CSS file name.

## Findings

| # | Severity | Finding |
| --- | --- | --- |
| A1 | Gate not met (documented, not a defect) | The original "**built bundle hash unchanged from #26**" gate is **not met**. One unused CSS rule (+30 bytes raw, +6 gzip) changes the CSS file name, which changes the hashed references in all three JS chunks and `index.html`. JS logic is byte-identical once normalised. |
| A2 | Note | **I couldn't reproduce the reported "+32 bytes"; in an identical environment the delta is +30 bytes.** The added rule `.rounded{border-radius:.25rem}` is exactly 30 bytes. The reported 32 may come from a different measurement method; it doesn't change the conclusion. |
| — | No other findings | No larger or unexplained delta. No functional, scope or provenance issue was found. |

**Verdict:** #30 is a faithful, byte-identical assembly of #27 and #28 onto #26 with no runtime consumer. The only build effect is the documented +30-byte unused CSS rule and the resulting hash and reference changes. Following the instructions, I made no source-scan or application fix. #30 stays frozen.
