#!/usr/bin/env python3
"""
Fetch official daily & monthly precipitation for Hilliard, OH and surrounding
areas from NOAA's Applied Climate Information System (ACIS, data.rcc-acis.org),
which serves NWS ASOS/COOP and CoCoRaHS gauge data.

Writes data/rainfall.json:
  - monthly totals for the trailing HISTORY_YEARS years (all stations)
  - daily values for the trailing DAILY_WINDOW_DAYS days
  - exact station coordinates/elevation from ACIS metadata

No API key required. Run from anywhere; paths resolve relative to repo root.
"""
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ACIS_URL = "https://data.rcc-acis.org/StnData"
DAILY_WINDOW_DAYS = 240   # most recent days kept at daily resolution (covers YTD for sewer-flow comparison)
HISTORY_YEARS = 5         # monthly totals kept this far back

STATIONS = [
    {"id": "KOSU",        "name": "The Ohio State University Airport (Don Scott Field)",
     "network": "NWS/FAA ASOS — federal",     "note": "≈4 mi NE of Hilliard"},
    {"id": "KCMH",        "name": "John Glenn Columbus International Airport",
     "network": "NWS/FAA ASOS — federal",     "note": "≈14 mi E of Hilliard"},
    {"id": "US1OHFR0158", "name": "Hilliard 2.4 SW",
     "network": "CoCoRaHS (NOAA/NWS partner)", "note": "in Hilliard"},
    {"id": "US1OHFR0175", "name": "Hilliard 1.6 ENE",
     "network": "CoCoRaHS (NOAA/NWS partner)", "note": "in Hilliard"},
    {"id": "US1OHFR0002", "name": "Dublin 3.2 ENE",
     "network": "CoCoRaHS (NOAA/NWS partner)", "note": "≈6 mi NE of Hilliard"},
    {"id": "US1OHFR0059", "name": "New Rome 2.2 NW",
     "network": "CoCoRaHS (NOAA/NWS partner)", "note": "≈4 mi S of Hilliard"},
]

_NUM = re.compile(r"^(-?\d+(?:\.\d+)?)")


def parse_value(v):
    """ACIS precip value -> inches (float) or None.

    'T' (trace) -> 0.0; 'M' (missing) / 'S' (accumulation member) / '' -> None.
    Trailing QC/accumulation flags such as '3.41A' are stripped to the number.
    """
    if v is None:
        return None
    s = str(v).strip()
    if s in ("M", "S", ""):
        return None
    if s == "T":
        return 0.0
    m = _NUM.match(s)
    return float(m.group(1)) if m else None


def acis_request(payload):
    req = urllib.request.Request(
        ACIS_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json",
                 "User-Agent": "hilliard-rainfall-dashboard"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def fetch_station(sid, monthly_start, daily_start, edate):
    monthly = acis_request({
        "sid": sid, "sdate": monthly_start, "edate": edate.strftime("%Y-%m"),
        "elems": [{"name": "pcpn", "interval": "mly", "duration": "mly",
                   "reduce": "sum"}],
        "meta": ["name", "ll", "elev", "valid_daterange"],
    })
    daily = acis_request({
        "sid": sid, "sdate": daily_start.isoformat(), "edate": edate.isoformat(),
        "elems": [{"name": "pcpn"}],
    })
    meta = monthly.get("meta", {})
    ll = meta.get("ll") or [None, None]
    vdr = meta.get("valid_daterange") or [[None, None]]
    return {
        "acis_name": meta.get("name"),
        "lat": ll[1], "lon": ll[0],
        "elev_ft": meta.get("elev"),
        "record_start": vdr[0][0] if vdr and vdr[0] else None,
        "monthly": [[d, parse_value(v)] for d, v in monthly.get("data", [])],
        "daily": [[d, parse_value(v)] for d, v in daily.get("data", [])],
    }


def main():
    today = date.today()
    edate = today - timedelta(days=1)          # yesterday = last complete day
    daily_start = edate - timedelta(days=DAILY_WINDOW_DAYS - 1)
    m_start = date(today.year - HISTORY_YEARS, today.month, 1).strftime("%Y-%m")

    out = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "units": "inches",
        "daily_window_days": DAILY_WINDOW_DAYS,
        "history_start_month": m_start,
        "source": "NOAA ACIS (data.rcc-acis.org) — NWS ASOS & CoCoRaHS gauges",
        "stations": [],
    }

    failures = []
    for st in STATIONS:
        try:
            data = fetch_station(st["id"], m_start, daily_start, edate)
            out["stations"].append({**st, **data})
            print(f"ok  {st['id']:>12}  {data['acis_name']}")
        except Exception as e:                                  # keep going
            failures.append(st["id"])
            print(f"FAIL {st['id']:>12}  {e}", file=sys.stderr)

    if not out["stations"]:
        sys.exit("All station fetches failed; not writing rainfall.json")

    dest = Path(__file__).resolve().parents[1] / "data" / "rainfall.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"wrote {dest} ({len(out['stations'])} stations,"
          f" {len(failures)} failures)")


if __name__ == "__main__":
    main()
