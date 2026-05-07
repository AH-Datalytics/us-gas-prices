"""
Scrape AAA gas prices at state and county level.
Uses Playwright to render the JS-heavy pages and extract county map data.

Usage:
  python scripts/scrape_aaa.py                # Scrape all 50 states + DC
  python scripts/scrape_aaa.py --state TX     # Scrape one state
  python scripts/scrape_aaa.py --states-only  # State averages only (fast, no Playwright)
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from datetime import date

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "web", "us_energy.db")

# State codes and names for AAA URLs
STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine",
    "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
    "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
    "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
    "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}


def ensure_schema(conn):
    """Create AAA-specific tables if they don't exist."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS aaa_state_prices (
            date TEXT NOT NULL,
            state TEXT NOT NULL,
            state_name TEXT,
            regular REAL,
            midgrade REAL,
            premium REAL,
            diesel REAL,
            PRIMARY KEY (date, state)
        );
        CREATE TABLE IF NOT EXISTS aaa_county_prices (
            date TEXT NOT NULL,
            state TEXT NOT NULL,
            county TEXT NOT NULL,
            price REAL,
            PRIMARY KEY (date, state, county)
        );
        CREATE TABLE IF NOT EXISTS aaa_metro_prices (
            date TEXT NOT NULL,
            state TEXT NOT NULL,
            metro TEXT NOT NULL,
            regular REAL,
            midgrade REAL,
            premium REAL,
            diesel REAL,
            PRIMARY KEY (date, state, metro)
        );
        CREATE INDEX IF NOT EXISTS idx_aaa_state ON aaa_state_prices(state, date);
        CREATE INDEX IF NOT EXISTS idx_aaa_county ON aaa_county_prices(state, date);
        CREATE INDEX IF NOT EXISTS idx_aaa_metro ON aaa_metro_prices(state, date);
    """)


def scrape_state_averages(conn):
    """Scrape the state averages page (no Playwright needed — try WebFetch first)."""
    from playwright.sync_api import sync_playwright

    today = date.today().isoformat()
    print(f"\n=== Scraping AAA State Averages ({today}) ===")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://gasprices.aaa.com/state-gas-price-averages/", wait_until="networkidle", timeout=30000)

        # Extract state table
        rows = page.query_selector_all("table.sortable-table tbody tr")
        inserted = 0
        for row in rows:
            cells = row.query_selector_all("td")
            if len(cells) < 5:
                continue
            state_name = (cells[0].inner_text() or "").strip()
            # Find state code from name
            state_code = None
            for code, name in STATES.items():
                if name.lower() == state_name.lower():
                    state_code = code
                    break
            if not state_code:
                continue

            def parse_price(cell):
                txt = (cell.inner_text() or "").strip().replace("$", "").replace(",", "")
                try:
                    return float(txt)
                except (ValueError, TypeError):
                    return None

            regular = parse_price(cells[1])
            midgrade = parse_price(cells[2])
            premium = parse_price(cells[3])
            diesel = parse_price(cells[4])

            conn.execute(
                """INSERT OR REPLACE INTO aaa_state_prices
                   (date, state, state_name, regular, midgrade, premium, diesel)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (today, state_code, state_name, regular, midgrade, premium, diesel),
            )
            inserted += 1

        browser.close()

    conn.commit()
    print(f"  Inserted {inserted} state prices")


def scrape_county_data(conn, state_code):
    """Scrape county-level prices for a single state via Playwright."""
    from playwright.sync_api import sync_playwright

    today = date.today().isoformat()
    state_name = STATES.get(state_code, state_code)
    print(f"  Scraping counties for {state_name} ({state_code})...", end=" ", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.set_default_timeout(20000)
        page = context.new_page()

        # Capture the map data JS response
        map_data_text = []

        def on_response(response):
            if "premiumhtml5map_js_data" in response.url:
                try:
                    map_data_text.append(response.text())
                except Exception:
                    pass

        page.on("response", on_response)
        page.goto(
            f"https://gasprices.aaa.com/?state={state_code}",
            wait_until="domcontentloaded",
            timeout=20000,
        )
        page.wait_for_timeout(3000)  # brief wait for map data JS to fire

        # Also scrape metro area tables
        metro_rows = page.query_selector_all("table.sortable-table tbody tr")
        metros_inserted = 0
        for row in metro_rows:
            cells = row.query_selector_all("td")
            if len(cells) < 5:
                continue
            metro_name = (cells[0].inner_text() or "").strip()
            if not metro_name:
                continue

            def parse_price(cell):
                txt = (cell.inner_text() or "").strip().replace("$", "").replace(",", "")
                try:
                    return float(txt)
                except (ValueError, TypeError):
                    return None

            conn.execute(
                """INSERT OR REPLACE INTO aaa_metro_prices
                   (date, state, metro, regular, midgrade, premium, diesel)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (today, state_code, metro_name, parse_price(cells[1]),
                 parse_price(cells[2]), parse_price(cells[3]), parse_price(cells[4])),
            )
            metros_inserted += 1

        browser.close()

    # Parse county data from the captured JS using regex
    # The map data contains entries like: "name":"Autauga","shortname":"","link":"","comment":"$4.034"
    counties_inserted = 0
    for js_text in map_data_text:
        matches = re.findall(
            r'"name":"([^"]+)","shortname":"[^"]*","link":"[^"]*","comment":"\$([0-9.]+)"',
            js_text,
        )
        for county_name, price_str in matches:
            try:
                price = float(price_str)
            except (ValueError, TypeError):
                continue

            conn.execute(
                """INSERT OR REPLACE INTO aaa_county_prices
                   (date, state, county, price)
                   VALUES (?, ?, ?, ?)""",
                (today, state_code, county_name, price),
            )
            counties_inserted += 1

    conn.commit()
    print(f"{counties_inserted} counties, {metros_inserted} metros")
    return counties_inserted


def main():
    parser = argparse.ArgumentParser(description="Scrape AAA gas prices")
    parser.add_argument("--state", help="Scrape a single state (e.g., TX)")
    parser.add_argument("--states-only", action="store_true", help="Only scrape state averages, skip counties")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    ensure_schema(conn)

    # Always scrape state averages
    scrape_state_averages(conn)

    if not args.states_only:
        if args.state:
            states_to_scrape = [args.state.upper()]
        else:
            states_to_scrape = sorted(STATES.keys())

        print(f"\n=== Scraping county data for {len(states_to_scrape)} states ===")
        total_counties = 0
        for state_code in states_to_scrape:
            try:
                n = scrape_county_data(conn, state_code)
                total_counties += n
            except Exception as e:
                print(f"  ERROR scraping {state_code}: {e}")
            time.sleep(1)  # Be polite

        print(f"\nTotal: {total_counties} county prices scraped")

    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()
