"""
Daily incremental update — fetch latest data from EIA + AAA and upsert into DB.
Intended to be called by GitHub Actions.
"""

import os
import sqlite3
import sys
from datetime import datetime, date

# Reuse backfill functions — they all use INSERT OR REPLACE so re-fetching is safe
sys.path.insert(0, os.path.dirname(__file__))
from backfill import (
    backfill_gas_prices,
    backfill_steo,
    DB_PATH,
    API_KEY,
)
from scrape_aaa import ensure_schema as ensure_aaa_schema, scrape_state_averages, scrape_county_data, STATES


def main():
    if not API_KEY:
        print("ERROR: Set EIA_API_KEY environment variable")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)

    # Apply schema in case tables are missing
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path) as f:
        conn.executescript(f.read())

    print(f"=== Daily Update — {datetime.now().isoformat()} ===")

    # ── EIA data ──
    print("\n── EIA Data ──")
    backfill_gas_prices(conn)
    backfill_steo(conn)

    # ── AAA data ──
    print("\n── AAA Data ──")
    ensure_aaa_schema(conn)
    try:
        scrape_state_averages(conn)
    except Exception as e:
        print(f"  WARNING: AAA state averages failed: {e}")

    # County data — only on Mondays (day 0) to keep daily runs fast
    if date.today().weekday() == 0:
        print(f"\n  Scraping county data for {len(STATES)} states (Monday run)...")
        for state_code in sorted(STATES.keys()):
            try:
                scrape_county_data(conn, state_code)
            except Exception as e:
                print(f"  WARNING: AAA county {state_code} failed: {e}")
    else:
        print("  Skipping county scrape (runs Mondays)")

    conn.close()
    print("\nDaily update complete!")


if __name__ == "__main__":
    main()
