#!/bin/bash
# Plain HTTP GET probes (no bot-protection bypass): status, final URL, size, title.
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36'
OUT=/private/tmp/claude-501/-Users-oscarlopez-sbu-2026/c9756a10-ad03-4cfa-b0b2-d4c2b5311959/scratchpad/p5dqa/fetch
mkdir -p "$OUT"
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  r=$(curl -sL -m 25 -A "$UA" -o "$OUT/$i.body" -w '%{http_code} %{url_effective} %{size_download} %{content_type}' "$url")
  t=$(grep -o -i '<title>[^<]*' "$OUT/$i.body" 2>/dev/null | head -1 | cut -c8-100)
  echo "$i | $(date -u +%FT%TZ) | $url | $r | $t"
done <<'EOF'
https://www.mta.info/document/194866
https://www.mta.info/fares/lirr
https://www.mta.info/schedules/lirr
https://new.mta.info/agency/long-island-rail-road/timetables
https://www.amtrak.com/
https://www.amtrak.com/lake-shore-limited-train
https://content.amtrak.com/content/timetable/Northeast%20Regional.pdf
https://content.amtrak.com/content/timetable/Lake-Shore-Limited.pdf
https://www.njtransit.com/adjustedfares
https://www.njtransit.com/tickets/train-tickets
https://www.septa.org/fares/
https://www.septa.org/schedules/TRE
https://www.septa.org/fares/regional-rail/
https://www.greyhound.com/bus-routes/richmond-va-raleigh-nc
https://www.greyhound.com/bus-routes/north-charleston-sc-savannah-ga
https://www.greyhound.com/bus-routes/albany-ny-boston-ma
https://www.greyhound.com/bus-routes/fayetteville-nc-savannah-ga
EOF
