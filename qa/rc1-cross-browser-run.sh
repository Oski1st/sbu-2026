#!/bin/sh
# Runs the RC1 cross-browser pass against a running server (default port 4188).
# Usage: sh qa/rc1-cross-browser-run.sh [baseURL]
# Requires: node_modules/playwright 1.64.1 and `node node_modules/playwright/cli.js install chromium firefox webkit`.
# Raw screenshots go to qa-results/ (gitignored); logs/JSON and side-by-side images go to docs/qa/rc1-cross-browser/.
BASE=${1:-http://127.0.0.1:4188}
OUT=docs/qa/rc1-cross-browser
RAW=qa-results/rc1-cross-browser
mkdir -p "$RAW/shots" "$OUT/results"
for e in chromium firefox webkit; do
  for p in desktop phone; do
    node qa/rc1-cross-browser-features.cjs "$BASE" "$RAW/shots" "$e" "$p" "$OUT/results/features-$e-$p.json" > "$OUT/results/features-$e-$p.log" 2>&1 &
  done
  node qa/rc1-cross-browser-e2e.cjs "$BASE" "$RAW/e2e-shots/$e" "$e" > "$OUT/results/e2e-$e.log" 2>&1 &
  wait
done
node qa/rc1-webkit-probes.cjs "$BASE" > "$OUT/results/webkit-probes.log" 2>&1
node qa/rc1-cross-browser-sidebyside.cjs "$RAW/shots" "$OUT/compare"
grep -h "checks passed" "$OUT"/results/*.log
