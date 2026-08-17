# Hilliard, Ohio Rainfall Dashboard

A self-updating rainfall dashboard for Hilliard, OH and surrounding areas, built for
GitHub Pages. Data comes from official gauges served by NOAA's Applied Climate
Information System (ACIS): National Weather Service ASOS airport gauges and
NOAA/NWS-partner CoCoRaHS gauges. No API key required.

Recent days are shown at daily resolution (last 120 days); older data is
summarized as monthly totals covering a rolling 5-year history.

## Stations

| ID | Station | Network | Coordinates |
|---|---|---|---|
| US1OHFR0158 | Hilliard 2.4 SW | CoCoRaHS | 40.01765, -83.18027 |
| US1OHFR0175 | Hilliard 1.6 ENE | CoCoRaHS | 40.04967, -83.11705 |
| KOSU | OSU Airport (Don Scott Field) | NWS/FAA ASOS | 40.07841, -83.07833 |
| KCMH | John Glenn Columbus Intl | NWS/FAA ASOS | 39.99068, -82.87703 |
| US1OHFR0002 | Dublin 3.2 ENE | CoCoRaHS | 40.12990, -83.07420 |
| US1OHFR0059 | New Rome 2.2 NW | CoCoRaHS | 39.97598, -83.16671 |

Edit the `STATIONS` list in `scripts/fetch_data.py` to add or remove gauges
(any ACIS station ID works — NWS COOP, ASOS, or CoCoRaHS).

## Setup (one time)

1. Create a new GitHub repository and push this folder's contents to it.
2. In the repo: **Settings → Pages → Source: Deploy from a branch**, branch
   `main`, folder `/ (root)`. Save.
3. In **Settings → Actions → General → Workflow permissions**, select
   **Read and write permissions**. Save.
4. Done. The site appears at `https://<username>.github.io/<repo>/` within a
   few minutes.

## Daily updates

`.github/workflows/update-data.yml` runs every day at 11:30 UTC (~7:30 AM
Eastern), pulls the latest data from ACIS, rewrites `data/rainfall.json`, and
commits it — which automatically republishes the page. You can also trigger it
manually from the **Actions** tab (*Update rainfall data → Run workflow*).

## Local preview

```
python3 -m http.server   # then open http://localhost:8000
```

(Opening `index.html` directly from disk won't load the JSON due to browser
file:// restrictions.)

## Files

- `index.html` — the dashboard (Chart.js, no build step)
- `data/rainfall.json` — daily + monthly precipitation, regenerated each run
- `scripts/fetch_data.py` — fetcher (Python 3 stdlib only)
- `.github/workflows/update-data.yml` — daily automation

## Data notes

- Units: inches. "T" (trace) is stored as 0. Missing reports are `null`.
- Values carry the NWS observation day; CoCoRaHS gauges report each morning
  for the preceding 24 hours.
- Multi-day accumulations (flagged `S`/`A` by ACIS) are credited to the day
  the accumulation was reported.
