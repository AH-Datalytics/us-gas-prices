"""Quick single-BA backfill for testing."""
import os, sqlite3, sys, time, requests

API_KEY = os.environ.get("EIA_API_KEY", "")
BASE = "https://api.eia.gov/v2"
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "web", "us_energy.db")

def fetch_paginated(url, params, desc=""):
    params = {**params, "api_key": API_KEY, "length": 5000}
    all_rows, offset = [], 0
    while True:
        params["offset"] = offset
        print(f"  [{desc}] offset={offset}...", end=" ", flush=True)
        resp = requests.get(url, params=params, timeout=60)
        if resp.status_code == 429:
            print("RATE LIMITED — 60s"); time.sleep(60); continue
        resp.raise_for_status()
        data = resp.json()
        rows = data.get("response",{}).get("data",[])
        total = int(data.get("response",{}).get("total",0) or 0)
        print(f"{len(rows)} rows (total: {total})")
        all_rows.extend(rows)
        if len(all_rows) >= total or not rows: break
        offset += 5000; time.sleep(0.7)
    return all_rows

ba = sys.argv[1] if len(sys.argv) > 1 else "ERCO"
conn = sqlite3.connect(DB_PATH)
schema = os.path.join(os.path.dirname(__file__), "schema.sql")
with open(schema) as f: conn.executescript(f.read())

print(f"\n=== Grid Demand for {ba} ===")
for dtype in ["D", "DF", "NG", "TI"]:
    rows = fetch_paginated(f"{BASE}/electricity/rto/region-data/data",
        {"data[]":"value","facets[respondent][]":ba,"facets[type][]":dtype,
         "frequency":"hourly","start":"2024-01-01T00",
         "sort[0][column]":"period","sort[0][direction]":"asc"},
        desc=f"{ba}/{dtype}")
    n = 0
    for r in rows:
        v = r.get("value")
        if v is None or v == "": continue
        try: val = float(v)
        except: continue
        conn.execute("INSERT OR REPLACE INTO grid_demand (period,respondent,respondent_name,type,value) VALUES(?,?,?,?,?)",
            (r["period"], ba, r.get("respondent-name",""), dtype, val))
        n += 1
    conn.commit()
    print(f"  Inserted {n} rows for {ba}/{dtype}")

print(f"\n=== Grid Fuel for {ba} ===")
rows = fetch_paginated(f"{BASE}/electricity/rto/fuel-type-data/data",
    {"data[]":"value","facets[respondent][]":ba,
     "frequency":"hourly","start":"2024-01-01T00",
     "sort[0][column]":"period","sort[0][direction]":"asc"},
    desc=f"fuel/{ba}")
n = 0
for r in rows:
    v = r.get("value")
    if v is None or v == "": continue
    try: val = float(v)
    except: continue
    conn.execute("INSERT OR REPLACE INTO grid_fuel (period,respondent,fuel_type,fuel_name,value) VALUES(?,?,?,?,?)",
        (r["period"], ba, r.get("fueltype",""), r.get("type-name",""), val))
    n += 1
conn.commit()
print(f"  Inserted {n} rows for {ba}")
conn.close()
print("\nDone!")
