"""
BLS CPI-U backfill.

Pulls the monthly CPI-U index used to deflate nominal gas prices into real
dollars on the gas prices page.

Series: CUSR0000SA0 -- CPI-U, all items, U.S. city average, seasonally
adjusted. Seasonally adjusted is deliberate: gas prices are themselves
strongly seasonal, and deflating them with an unadjusted index would fold
general CPI seasonality into the real price series.

The BLS public API v1 needs no key but caps each request at 10 years, so a
full backfill is split into chunks. Daily updates only re-pull the trailing
couple of years.

Usage:
  python scripts/backfill_cpi.py                # full history (1990-present)
  python scripts/backfill_cpi.py --start 2024   # just recent years
"""

import argparse
import os
import sqlite3
import sys
import time
from datetime import date

import requests

SERIES_ID = "CUSR0000SA0"
BLS_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/"
CHUNK_YEARS = 10  # v1 API limit
FIRST_YEAR = 1990  # gas price history starts 1990-08
RATE_LIMIT_DELAY = 1.0

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "web", "us_energy.db")


def fetch_range(start_year, end_year):
    """Fetch CPI-U observations for an inclusive year range (<= 10 years)."""
    print(f"  [cpi] Fetching {start_year}-{end_year}...", end=" ", flush=True)
    try:
        resp = requests.post(
            BLS_URL,
            json={
                "seriesid": [SERIES_ID],
                "startyear": str(start_year),
                "endyear": str(end_year),
            },
            timeout=60,
        )
    except requests.exceptions.RequestException as e:
        print(f"REQUEST ERROR: {e}")
        return []

    if resp.status_code != 200:
        print(f"HTTP {resp.status_code}")
        return []

    payload = resp.json()
    if payload.get("status") != "REQUEST_SUCCEEDED":
        print(f"BLS ERROR: {payload.get('message')}")
        return []

    series = payload.get("Results", {}).get("series", [])
    raw = series[0].get("data", []) if series else []

    rows = []
    for obs in raw:
        period = obs.get("period", "")
        if not period.startswith("M") or period == "M13":  # M13 = annual average
            continue
        raw_value = obs.get("value")
        # BLS returns "-" for months it never published (e.g. the Oct 2025
        # lapse in appropriations). Skip them; the app carries the last
        # known index forward across gaps.
        if raw_value in (None, "", "-"):
            continue
        try:
            value = float(raw_value)
        except (ValueError, TypeError):
            continue
        rows.append((f"{obs['year']}-{period[1:]}", value))

    print(f"{len(rows)} months")
    return rows


def backfill_cpi(conn, start_year=FIRST_YEAR, end_year=None):
    """Upsert monthly CPI-U into the cpi table."""
    print("\n=== CPI-U (BLS) ===")
    end_year = end_year or date.today().year

    inserted = 0
    year = start_year
    while year <= end_year:
        chunk_end = min(year + CHUNK_YEARS - 1, end_year)
        for period, value in fetch_range(year, chunk_end):
            conn.execute(
                "INSERT OR REPLACE INTO cpi (period, series_id, value) VALUES (?, ?, ?)",
                (period, SERIES_ID, value),
            )
            inserted += 1
        conn.commit()
        year = chunk_end + 1
        if year <= end_year:
            time.sleep(RATE_LIMIT_DELAY)

    latest = conn.execute(
        "SELECT period, value FROM cpi WHERE series_id = ? ORDER BY period DESC LIMIT 1",
        (SERIES_ID,),
    ).fetchone()
    print(f"  Inserted {inserted} rows; latest = {latest[0]} ({latest[1]})" if latest
          else f"  Inserted {inserted} rows")
    return inserted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=FIRST_YEAR)
    parser.add_argument("--end", type=int, default=None)
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path) as f:
        conn.executescript(f.read())

    if backfill_cpi(conn, args.start, args.end) == 0:
        conn.close()
        sys.exit(1)
    conn.close()


if __name__ == "__main__":
    main()
