/*
 * Regenerate data/sewer.json from Hach FSDATA.
 *
 * HOW TO USE (takes ~1-2 minutes):
 *   1. Log in at https://hachfsdata.mccrometer.com and wait for the dashboard.
 *   2. Open the browser DevTools console (F12 or Cmd-Option-J) on that page.
 *   3. Paste this entire file into the console and press Enter.
 *   4. A file "sewer.json" downloads when done. Replace data/sewer.json in the
 *      GitHub repo with it and commit — the dashboard updates automatically.
 *
 * The script pulls year-to-date flow (5-15 min samples) for each monitor and
 * aggregates to daily mean/peak in gallons per minute. It only READS data.
 *
 * MONITORS: edit this list to add/remove monitors or fix coordinates.
 * If lat/lon is null and FSDATA has real GPS set (Site Properties on the
 * Dashboard > Map page, or Instrument Manager), the FSDATA value is used
 * automatically.
 *
 * `legacy` lists earlier FSDATA site records for the same physical monitor
 * (the city redeploys monitors under new siteNums). Their year-to-date data
 * is stitched in front of the current site's data automatically.
 *
 * 2026-08-25: FM25/FM27-FM31 GPS coordinates are now set in FSDATA
 * (Dashboard > Map > select site > Site Properties). Coordinates below were
 * read from FSDATA GetSiteInformation and hard-coded; delete a lat/lon (set
 * to null) to have the script re-read it from FSDATA on the next run.
 */
const MONITORS = [
  { id: "FM19",  siteNum: 52128, lat: 40.06427, lon: -83.12838, note: "NW Hilliard, near Davidson Rd/Leppert area", legacy: [] },
  { id: "FM20",  siteNum: 43063, lat: 40.02654, lon: -83.12835, note: "SE Hilliard", legacy: [] },
  { id: "FM22A", siteNum: 52650, lat: 40.03105, lon: -83.15348, note: "central Hilliard (FM-22 manhole)", legacy: [48952, 51941] },
  { id: "FM24",  siteNum: 51947, lat: 40.02975, lon: -83.16222, note: "SW Hilliard", legacy: [50363] },
  { id: "FM25",  siteNum: 52703, lat: 40.00960, lon: -83.15082, note: "S Hilliard", legacy: [48945] },
  { id: "FM27",  siteNum: 51946, lat: 40.02273, lon: -83.16288, note: "SW Hilliard", legacy: [51738] },
  { id: "FM28",  siteNum: 51748, lat: 40.02453, lon: -83.16325, note: "SW Hilliard", legacy: [] },
  { id: "FM29A", siteNum: 52648, lat: 40.03587, lon: -83.15443, note: "central Hilliard", legacy: [51933] },
  { id: "FM30",  siteNum: 51934, lat: 40.04337, lon: -83.15794, note: "N-central Hilliard", legacy: [] },
  { id: "FM31",  siteNum: 51936, lat: 40.02998, lon: -83.14692, note: "SE-central Hilliard", legacy: [] },
];
const RAIN_GAUGE_REF = { id: "RG2-HillFarm PS", lat: 40.03551, lon: -83.20140,
  note: "City rain gauge at Hilliard Farms pump station (FSDATA)" };

(async () => {
  const API = "https://fsdata-api.mccrometer.com";
  const tok = localStorage.getItem("access_token");
  if (!tok) { alert("Not logged in to FSDATA — log in first, then rerun."); return; }
  const H = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };

  const year = new Date().getFullYear();
  const today = new Date(); today.setHours(0,0,0,0);          // exclude partial today
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset()*60e3).toISOString().slice(0,19);

  // pull one site's YTD flow samples into a shared per-day accumulator
  async function pullSite(siteNum, days) {
    const det = (await (await fetch(`${API}/SiteDetails/${siteNum}`, {headers:H})).json());
    const d = det.dto || det;
    const ch = (d.channelInformation || []).find(c => c.channelTypeID === 15);
    if (!ch) return 0;
    const start = new Date(Math.max(new Date(year + "-01-01T00:00:00"), new Date(ch.minDataTime)));
    const stop  = new Date(Math.min(today, new Date(ch.maxDataTime)));
    let n = 0;
    for (let t = new Date(start); t < stop; ) {
      const t2 = new Date(Math.min(stop, t.getTime() + 20*86400e3));
      const body = { channelList: [{ channelName: "Flow", dbColumnName: ch.dbColumnName,
        channelSourceId: 0, channelTypeId: 15, measurementUnitId: 67 }],
        siteNum, startTime: iso(t), endTime: iso(t2) };
      const r = await fetch(`${API}/Data/GetSiteDataAverage?includeVmRecId=false&legacyAverage=true`,
        { method: "POST", headers: H, body: JSON.stringify(body) });
      const j = await r.json();
      for (const row of ((j.dto || {}).siteData || [])) {
        const ts = row.data.ID_2, v = row.data[ch.dbColumnName];
        if (ts == null || typeof v !== "number") continue;
        const day = String(ts).slice(0, 10);
        const o = (days[day] ||= { n: 0, sum: 0, max: -1e9 });
        o.n++; o.sum += v; if (v > o.max) o.max = v;
        n++;
      }
      t = t2;
    }
    return n;
  }

  const monitors = [];
  for (const cfg of MONITORS) {
    console.log("Fetching", cfg.id, "...");
    const info = (await (await fetch(`${API}/Sites/GetSiteInformation?siteNum=${cfg.siteNum}`, {headers:H})).json()).dto || {};
    const lat = cfg.lat ?? (info.latitude  && Math.abs(info.latitude)  > .01 ? +info.latitude.toFixed(5)  : null);
    const lon = cfg.lon ?? (info.longitude && Math.abs(info.longitude) > .01 ? +info.longitude.toFixed(5) : null);

    const days = {};
    for (const legacyNum of (cfg.legacy || [])) await pullSite(legacyNum, days);
    const got = await pullSite(cfg.siteNum, days);
    if (!got && !Object.keys(days).length) { console.warn(cfg.id, "no flow data — skipped"); continue; }

    const daily = Object.keys(days).sort()
      .map(d => [d, Math.round(days[d].sum / days[d].n), Math.round(days[d].max)]);
    monitors.push({ id: cfg.id, siteNum: cfg.siteNum, lat, lon, note: cfg.note,
      instrument: "Hach FL900 series", start: daily.length ? daily[0][0] : null, daily });
    console.log(cfg.id, "->", daily.length, "days");
  }

  const out = {
    generated_utc: new Date().toISOString().slice(0, 19) + "Z",
    units: "gallons per minute (gpm), daily mean and daily peak",
    source: "Hach FSDATA (hachfsdata.mccrometer.com) - City of Hilliard sanitary sewer flow monitors, 5-15 min samples aggregated to daily",
    rain_gauge_reference: RAIN_GAUGE_REF,
    monitors,
  };
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sewer.json";
  a.click();
  console.log("DONE — sewer.json downloaded. Replace data/sewer.json in the repo and commit.");
})();
