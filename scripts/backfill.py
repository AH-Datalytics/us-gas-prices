"""
EIA API v2 backfill script.
Pulls historical data from all endpoints and populates us_energy.db.

Usage:
  python scripts/backfill.py --module gas_prices
  python scripts/backfill.py --module steo
  python scripts/backfill.py --module grid_demand
  python scripts/backfill.py --module grid_fuel
  python scripts/backfill.py --module state_generation
  python scripts/backfill.py --module national_energy
  python scripts/backfill.py --module state_energy
  python scripts/backfill.py --module all
"""

import argparse
import os
import sqlite3
import sys
import time

import requests

API_KEY = os.environ.get("EIA_API_KEY", "")
BASE = "https://api.eia.gov/v2"
PAGE_SIZE = 5000
RATE_LIMIT_DELAY = 0.7  # seconds between requests (safe for 100/min)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "web", "us_energy.db")

BA_CODES = ["US48", "ERCO", "CISO", "PJM", "MISO", "ISNE", "NYIS", "SWPP", "NW", "SE", "FLA"]


def fetch_paginated(url, params, description=""):
    """Fetch all pages from an EIA API endpoint."""
    params = {**params, "api_key": API_KEY, "length": PAGE_SIZE}
    all_rows = []
    offset = 0

    while True:
        params["offset"] = offset
        print(f"  [{description}] Fetching offset={offset}...", end=" ", flush=True)
        try:
            resp = requests.get(url, params=params, timeout=60)
        except requests.exceptions.RequestException as e:
            print(f"REQUEST ERROR: {e} — retrying in 30s")
            time.sleep(30)
            continue

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            print(f"RATE LIMITED — waiting {retry_after}s")
            time.sleep(min(retry_after, 120))
            continue

        if resp.status_code >= 500:
            print(f"SERVER ERROR {resp.status_code} — retrying in 30s")
            time.sleep(30)
            continue

        resp.raise_for_status()
        data = resp.json()

        rows = data.get("response", {}).get("data", [])
        total_raw = data.get("response", {}).get("total", 0)
        total = int(total_raw) if total_raw else 0
        print(f"got {len(rows)} rows (total: {total})")

        all_rows.extend(rows)

        if len(all_rows) >= total or len(rows) == 0:
            break

        offset += PAGE_SIZE
        time.sleep(RATE_LIMIT_DELAY)

    return all_rows


def backfill_gas_prices(conn):
    """Retail gasoline and diesel prices — weekly, by state + national."""
    print("\n=== Gas Prices (petroleum/pri/gnd) ===")

    for product_id, product_name in [("EPMR", "regular_gas"), ("EPD2DXL0", "diesel")]:
        rows = fetch_paginated(
            f"{BASE}/petroleum/pri/gnd/data",
            {
                "data[]": "value",
                "facets[product][]": product_id,
                "frequency": "weekly",
                "sort[0][column]": "period",
                "sort[0][direction]": "asc",
            },
            description=f"gas_prices/{product_name}",
        )

        inserted = 0
        for row in rows:
            period = row.get("period", "")
            area_name = row.get("area-name", "")
            duoarea = row.get("duoarea", "")
            raw_value = row.get("value")
            if raw_value is None or raw_value == "":
                continue
            try:
                value = float(raw_value)
            except (ValueError, TypeError):
                continue

            # Determine area type from duoarea code
            if duoarea == "NUS":
                area_type, area_id = "national", "US"
            elif duoarea.startswith("S") and len(duoarea) == 3:
                area_type, area_id = "state", duoarea[1:]
            elif duoarea.startswith("R"):
                area_type, area_id = "padd", duoarea
            else:
                area_type, area_id = "city", duoarea

            conn.execute(
                """INSERT OR REPLACE INTO gas_prices
                   (period, area_type, area_id, area_name, product, price)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (period, area_type, area_id, area_name, product_name, value),
            )
            inserted += 1

        conn.commit()
        print(f"  Inserted {inserted} {product_name} rows")


def backfill_steo(conn):
    """Short-Term Energy Outlook — monthly forecasts."""
    print("\n=== STEO Forecasts ===")

    series_ids = [
        "MGRARUS_$",  # Regular gasoline retail price ($/gal)
        "DSRTUUS_$",  # Diesel retail price ($/gal)
        "BREPUUS",    # Brent crude spot
        "WTIPUUS",    # WTI crude spot
        "NGHHUUS",    # Henry Hub natural gas
        "ESRCUUS",    # Residential electricity price
    ]

    for series_id in series_ids:
        rows = fetch_paginated(
            f"{BASE}/steo/data",
            {
                "data[]": "value",
                "facets[seriesId][]": series_id,
                "frequency": "monthly",
                "sort[0][column]": "period",
                "sort[0][direction]": "asc",
            },
            description=f"steo/{series_id}",
        )

        inserted = 0
        for row in rows:
            period = row.get("period", "")
            raw_val = row.get("value")
            series_name = row.get("seriesName", "")
            unit = row.get("unit", "")
            if raw_val is None or raw_val == "":
                continue
            try:
                value = float(raw_val)
            except (ValueError, TypeError):
                continue

            conn.execute(
                """INSERT OR REPLACE INTO steo_forecast
                   (period, series_id, series_name, value, unit, forecast_date)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (period, series_id, series_name, value, unit, "latest"),
            )
            inserted += 1

        conn.commit()
        print(f"  Inserted {inserted} {series_id} rows")


def backfill_grid_demand(conn):
    """Hourly demand, forecast, generation, interchange by BA — last 2 years."""
    print("\n=== Grid Demand (hourly, last 2 years) ===")

    for ba in BA_CODES:
        for dtype in ["D", "DF", "NG", "TI"]:
            rows = fetch_paginated(
                f"{BASE}/electricity/rto/region-data/data",
                {
                    "data[]": "value",
                    "facets[respondent][]": ba,
                    "facets[type][]": dtype,
                    "frequency": "hourly",
                    "start": "2024-01-01T00",
                    "sort[0][column]": "period",
                    "sort[0][direction]": "asc",
                },
                description=f"grid_demand/{ba}/{dtype}",
            )

            inserted = 0
            for row in rows:
                period = row.get("period", "")
                respondent_name = row.get("respondent-name", "")
                raw_val = row.get("value")
                if raw_val is None or raw_val == "":
                    continue
                try:
                    value = float(raw_val)
                except (ValueError, TypeError):
                    continue

                conn.execute(
                    """INSERT OR REPLACE INTO grid_demand
                       (period, respondent, respondent_name, type, value)
                       VALUES (?, ?, ?, ?, ?)""",
                    (period, ba, respondent_name, dtype, value),
                )
                inserted += 1

            conn.commit()
            print(f"  Inserted {inserted} rows for {ba}/{dtype}")


def backfill_grid_fuel(conn):
    """Hourly generation by fuel type by BA — last 2 years."""
    print("\n=== Grid Fuel Type (hourly, last 2 years) ===")

    for ba in BA_CODES:
        rows = fetch_paginated(
            f"{BASE}/electricity/rto/fuel-type-data/data",
            {
                "data[]": "value",
                "facets[respondent][]": ba,
                "frequency": "hourly",
                "start": "2024-01-01T00",
                "sort[0][column]": "period",
                "sort[0][direction]": "asc",
            },
            description=f"grid_fuel/{ba}",
        )

        inserted = 0
        for row in rows:
            period = row.get("period", "")
            fuel_type = row.get("fueltype", "")
            fuel_name = row.get("type-name", "")
            raw_val = row.get("value")
            if raw_val is None or raw_val == "":
                continue
            try:
                value = float(raw_val)
            except (ValueError, TypeError):
                continue

            conn.execute(
                """INSERT OR REPLACE INTO grid_fuel
                   (period, respondent, fuel_type, fuel_name, value)
                   VALUES (?, ?, ?, ?, ?)""",
                (period, ba, fuel_type, fuel_name, value),
            )
            inserted += 1

        conn.commit()
        print(f"  Inserted {inserted} rows for {ba}")


def backfill_state_generation(conn):
    """Monthly electricity generation by state and fuel type — 2001-present."""
    print("\n=== State Generation (monthly) ===")

    rows = fetch_paginated(
        f"{BASE}/electricity/electric-power-operational-data/data",
        {
            "data[]": "generation",
            "facets[sectorid][]": "99",  # All sectors
            "frequency": "monthly",
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
        },
        description="state_generation",
    )

    inserted = 0
    for row in rows:
        period = row.get("period", "")
        state_id = row.get("stateid", "")
        fuel_type = row.get("fueltypeid", "")
        fuel_name = row.get("fueltypeDescription", "")
        raw_gen = row.get("generation")
        if raw_gen is None or raw_gen == "" or not state_id or state_id == "US":
            continue
        try:
            generation = float(raw_gen)
        except (ValueError, TypeError):
            continue

        conn.execute(
            """INSERT OR REPLACE INTO state_generation
               (period, state, fuel_type, fuel_name, generation)
               VALUES (?, ?, ?, ?, ?)""",
            (period, state_id, fuel_type, fuel_name, generation),
        )
        inserted += 1

    conn.commit()
    print(f"  Inserted {inserted} rows")


def backfill_national_energy(conn):
    """Monthly Energy Review — production, consumption, trade, emissions."""
    print("\n=== National Energy (Monthly Energy Review) ===")

    rows = fetch_paginated(
        f"{BASE}/total-energy/data",
        {
            "data[]": "value",
            "frequency": "monthly",
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
        },
        description="total_energy",
    )

    inserted = 0
    for row in rows:
        period = row.get("period", "")
        series_id = row.get("msn", "")
        series_name = row.get("seriesDescription", "")
        raw_val = row.get("value")
        unit = row.get("unit", "")
        if raw_val is None or raw_val == "" or not series_id:
            continue
        try:
            value = float(raw_val)
        except (ValueError, TypeError):
            continue

        conn.execute(
            """INSERT OR REPLACE INTO national_energy
               (period, series_id, series_name, value, unit)
               VALUES (?, ?, ?, ?, ?)""",
            (period, series_id, series_name, value, unit),
        )
        inserted += 1

    conn.commit()
    print(f"  Inserted {inserted} rows")


def backfill_state_energy(conn):
    """SEDS — state-level energy data, annual."""
    print("\n=== State Energy (SEDS, annual) ===")

    rows = fetch_paginated(
        f"{BASE}/seds/data",
        {
            "data[]": "value",
            "frequency": "annual",
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
        },
        description="seds",
    )

    inserted = 0
    for row in rows:
        year = row.get("period", "")
        state = row.get("stateId", "")
        series_id = row.get("seriesId", row.get("msn", ""))
        series_name = row.get("seriesDescription", row.get("seriesName", ""))
        raw_val = row.get("value")
        unit = row.get("unit", "")
        if raw_val is None or raw_val == "" or not state or state == "US":
            continue
        try:
            value = float(raw_val)
        except (ValueError, TypeError):
            continue

        try:
            year_int = int(year)
        except (ValueError, TypeError):
            continue

        conn.execute(
            """INSERT OR REPLACE INTO state_energy
               (year, state, series_id, series_name, value, unit)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (year_int, state, series_id, series_name, value, unit),
        )
        inserted += 1

    conn.commit()
    print(f"  Inserted {inserted} rows")


MODULE_MAP = {
    "gas_prices": backfill_gas_prices,
    "steo": backfill_steo,
    "grid_demand": backfill_grid_demand,
    "grid_fuel": backfill_grid_fuel,
    "state_generation": backfill_state_generation,
    "national_energy": backfill_national_energy,
    "state_energy": backfill_state_energy,
}


def main():
    parser = argparse.ArgumentParser(description="Backfill EIA data into us_energy.db")
    parser.add_argument("--module", default="all", choices=list(MODULE_MAP.keys()) + ["all"])
    args = parser.parse_args()

    if not API_KEY:
        print("ERROR: Set EIA_API_KEY environment variable")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)

    # Apply schema
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path) as f:
        conn.executescript(f.read())

    if args.module == "all":
        for name, func in MODULE_MAP.items():
            func(conn)
    else:
        MODULE_MAP[args.module](conn)

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
