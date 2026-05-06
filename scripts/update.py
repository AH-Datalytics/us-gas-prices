"""
Daily incremental update — fetch latest data from EIA and upsert into DB.
Intended to be called by GitHub Actions.
"""

import os
import sqlite3
import sys
from datetime import datetime

# Reuse backfill functions — they all use INSERT OR REPLACE so re-fetching is safe
sys.path.insert(0, os.path.dirname(__file__))
from backfill import (
    backfill_gas_prices,
    backfill_steo,
    backfill_grid_demand,
    backfill_grid_fuel,
    backfill_state_generation,
    backfill_national_energy,
    DB_PATH,
    API_KEY,
)


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

    backfill_gas_prices(conn)
    backfill_steo(conn)
    backfill_grid_demand(conn)
    backfill_grid_fuel(conn)
    backfill_state_generation(conn)
    backfill_national_energy(conn)

    conn.close()
    print("\nDaily update complete!")


if __name__ == "__main__":
    main()
