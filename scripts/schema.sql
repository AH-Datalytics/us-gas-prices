-- Grid Monitor: Hourly demand/generation/interchange by balancing authority
CREATE TABLE IF NOT EXISTS grid_demand (
  period TEXT NOT NULL,
  respondent TEXT NOT NULL,
  respondent_name TEXT,
  type TEXT NOT NULL,
  value REAL,
  PRIMARY KEY (period, respondent, type)
);

CREATE TABLE IF NOT EXISTS grid_fuel (
  period TEXT NOT NULL,
  respondent TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  fuel_name TEXT,
  value REAL,
  PRIMARY KEY (period, respondent, fuel_type)
);

CREATE TABLE IF NOT EXISTS grid_interchange (
  period TEXT NOT NULL,
  from_ba TEXT NOT NULL,
  to_ba TEXT NOT NULL,
  from_ba_name TEXT,
  to_ba_name TEXT,
  value REAL,
  PRIMARY KEY (period, from_ba, to_ba)
);

-- Grid Monitor: State monthly generation by fuel type
CREATE TABLE IF NOT EXISTS state_generation (
  period TEXT NOT NULL,
  state TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  fuel_name TEXT,
  generation REAL,
  PRIMARY KEY (period, state, fuel_type)
);

-- National Energy (Monthly Energy Review)
CREATE TABLE IF NOT EXISTS national_energy (
  period TEXT NOT NULL,
  series_id TEXT NOT NULL,
  series_name TEXT,
  value REAL,
  unit TEXT,
  PRIMARY KEY (period, series_id)
);

-- State Energy (SEDS, annual)
CREATE TABLE IF NOT EXISTS state_energy (
  year INTEGER NOT NULL,
  state TEXT NOT NULL,
  series_id TEXT NOT NULL,
  series_name TEXT,
  value REAL,
  unit TEXT,
  PRIMARY KEY (year, state, series_id)
);

-- Gas Prices (weekly)
CREATE TABLE IF NOT EXISTS gas_prices (
  period TEXT NOT NULL,
  area_type TEXT NOT NULL,
  area_id TEXT NOT NULL,
  area_name TEXT,
  product TEXT NOT NULL,
  price REAL,
  PRIMARY KEY (period, area_type, area_id, product)
);

-- STEO Forecasts (monthly projections)
CREATE TABLE IF NOT EXISTS steo_forecast (
  period TEXT NOT NULL,
  series_id TEXT NOT NULL,
  series_name TEXT,
  value REAL,
  unit TEXT,
  forecast_date TEXT NOT NULL,
  PRIMARY KEY (period, series_id, forecast_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grid_demand_resp ON grid_demand(respondent, period);
CREATE INDEX IF NOT EXISTS idx_grid_fuel_resp ON grid_fuel(respondent, period);
CREATE INDEX IF NOT EXISTS idx_grid_interchange_from ON grid_interchange(from_ba, period);
CREATE INDEX IF NOT EXISTS idx_state_gen_state ON state_generation(state, period);
CREATE INDEX IF NOT EXISTS idx_national_series ON national_energy(series_id, period);
CREATE INDEX IF NOT EXISTS idx_state_energy_state ON state_energy(state, year);
CREATE INDEX IF NOT EXISTS idx_gas_area ON gas_prices(area_type, area_id, period);
CREATE INDEX IF NOT EXISTS idx_steo_series ON steo_forecast(series_id, period);
