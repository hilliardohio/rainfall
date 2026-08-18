# Hilliard - Rainfall and Sanitary Sewer Flow Dashboard

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

## Sanitary sewer flow monitoring

The dashboard also shows the City of Hilliard's sanitary sewer flow monitors
(Hach FL900 units reporting to the FSDATA portal at hachfsdata.mccrometer.com):
a location map, year-to-date daily mean/peak flow in gallons per minute, and a
combined chart overlaying daily rainfall on each monitor's flow so
inflow & infiltration response is visible.

**Updating sewer data:** FSDATA requires a login, so this part is not updated
by the GitHub Action. To refresh (takes ~2 minutes):

1. Log in at https://hachfsdata.mccrometer.com
2. Open the browser DevTools console on that page (F12)
3. Paste the entire contents of `scripts/update_sewer.js` and press Enter
4. A fresh `sewer.json` downloads — replace `data/sewer.json` in this repo
   and commit

Monitor coordinates: FM19/FM20/FM22A/FM24 use GPS from legacy FSDATA site
entries; FM25/27/28/29A/30/31 have no GPS in FSDATA. Edit the `MONITORS` list
at the top of `scripts/update_sewer.js` (and `data/sewer.json`) to add them —
or set real GPS in FSDATA's Instrument Manager and rerun the update script.

If the city obtains FSDATA API credentials from McCrometer, the update could
be fully automated in the GitHub Action like the rainfall data.

## Files

- `index.html` — the dashboard (Chart.js + Leaflet, no build step)
- `data/rainfall.json` — daily + monthly precipitation, regenerated each run
- `data/sewer.json` — daily sewer flow per monitor (semi-manual refresh)
- `scripts/fetch_data.py` — rainfall fetcher (Python 3 stdlib only)
- `scripts/update_sewer.js` — sewer-flow refresh script (paste into FSDATA console)
- `.github/workflows/update-data.yml` — daily automation

## Data notes

- Units: inches. "T" (trace) is stored as 0. Missing reports are `null`.
- Values carry the NWS observation day; CoCoRaHS gauges report each morning
  for the preceding 24 hours.
- Multi-day accumulations (flagged `S`/`A` by ACIS) are credited to the day
  the accumulation was reported.
