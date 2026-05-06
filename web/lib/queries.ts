import { cachedPrepare } from "./db";

// ─── Grid Monitor ────────────────────────

export interface GridDemandRow {
  period: string;
  type: string;
  value: number;
}

export function getGridDemand(respondent: string, start: string, end: string): GridDemandRow[] {
  return cachedPrepare(
    `SELECT period, type, value FROM grid_demand
     WHERE respondent = ? AND period >= ? AND period <= ?
     ORDER BY period`
  ).all(respondent, start, end) as GridDemandRow[];
}

export interface GridFuelRow {
  period: string;
  fuel_type: string;
  fuel_name: string;
  value: number;
}

export function getGridFuel(respondent: string, start: string, end: string): GridFuelRow[] {
  return cachedPrepare(
    `SELECT period, fuel_type, fuel_name, value FROM grid_fuel
     WHERE respondent = ? AND period >= ? AND period <= ?
     ORDER BY period`
  ).all(respondent, start, end) as GridFuelRow[];
}

export interface GridInterchangeRow {
  to_ba: string;
  to_ba_name: string;
  total_value: number;
}

export function getGridInterchange(fromBa: string, start: string, end: string): GridInterchangeRow[] {
  return cachedPrepare(
    `SELECT to_ba, to_ba_name, SUM(value) as total_value FROM grid_interchange
     WHERE from_ba = ? AND period >= ? AND period <= ?
     GROUP BY to_ba
     ORDER BY total_value DESC`
  ).all(fromBa, start, end) as GridInterchangeRow[];
}

// ─── State Generation ────────────────────

export interface StateGenRow {
  period: string;
  fuel_type: string;
  fuel_name: string;
  generation: number;
}

export function getStateGeneration(state: string, start: string, end: string): StateGenRow[] {
  return cachedPrepare(
    `SELECT period, fuel_type, fuel_name, SUM(generation) as generation
     FROM state_generation
     WHERE state = ? AND period >= ? AND period <= ?
     GROUP BY period, fuel_type
     ORDER BY period`
  ).all(state, start, end) as StateGenRow[];
}

// ─── National Energy ─────────────────────

export interface NationalEnergyRow {
  period: string;
  series_id: string;
  series_name: string;
  value: number;
  unit: string;
}

export function getNationalEnergy(seriesIds: string[], start: string, end: string): NationalEnergyRow[] {
  const placeholders = seriesIds.map(() => "?").join(",");
  return cachedPrepare(
    `SELECT period, series_id, series_name, value, unit
     FROM national_energy
     WHERE series_id IN (${placeholders}) AND period >= ? AND period <= ?
     ORDER BY period`
  ).all(...seriesIds, start, end) as NationalEnergyRow[];
}

// ─── State Energy (SEDS) ────────────────

export interface StateEnergyRow {
  year: number;
  series_id: string;
  series_name: string;
  value: number;
  unit: string;
}

export function getStateEnergy(state: string, seriesIds: string[]): StateEnergyRow[] {
  const placeholders = seriesIds.map(() => "?").join(",");
  return cachedPrepare(
    `SELECT year, series_id, series_name, value, unit
     FROM state_energy
     WHERE state = ? AND series_id IN (${placeholders})
     ORDER BY year`
  ).all(state, ...seriesIds) as StateEnergyRow[];
}

// ─── Gas Prices ──────────────────────────

export interface GasPriceRow {
  period: string;
  area_type: string;
  area_id: string;
  area_name: string;
  product: string;
  price: number;
}

export function getGasPrices(areaType: string, areaId: string, product: string, start?: string): GasPriceRow[] {
  const where = start
    ? "WHERE area_type = ? AND area_id = ? AND product = ? AND period >= ?"
    : "WHERE area_type = ? AND area_id = ? AND product = ?";
  const params = start ? [areaType, areaId, product, start] : [areaType, areaId, product];
  return cachedPrepare(
    `SELECT period, area_type, area_id, area_name, product, price
     FROM gas_prices ${where} ORDER BY period`
  ).all(...params) as GasPriceRow[];
}

export function getLatestGasPrices(product: string): GasPriceRow[] {
  return cachedPrepare(
    `SELECT gp.period, gp.area_type, gp.area_id, gp.area_name, gp.product, gp.price
     FROM gas_prices gp
     INNER JOIN (SELECT MAX(period) as max_period FROM gas_prices WHERE area_type = 'state' AND product = ?) latest
       ON gp.period = latest.max_period
     WHERE gp.area_type = 'state' AND gp.product = ?
     ORDER BY gp.price DESC`
  ).all(product, product) as GasPriceRow[];
}

export function getCitiesForState(stateId: string, product: string): GasPriceRow[] {
  return cachedPrepare(
    `SELECT period, area_type, area_id, area_name, product, price
     FROM gas_prices
     WHERE area_type = 'city' AND area_id LIKE ? AND product = ?
       AND period = (SELECT MAX(period) FROM gas_prices WHERE area_type = 'city' AND product = ?)
     ORDER BY area_name`
  ).all(`%${stateId}%`, product, product) as GasPriceRow[];
}

// ─── STEO Forecasts ──────────────────────

export interface SteoRow {
  period: string;
  series_id: string;
  series_name: string;
  value: number;
  unit: string;
}

export function getSteoForecast(seriesId: string): SteoRow[] {
  return cachedPrepare(
    `SELECT period, series_id, series_name, value, unit
     FROM steo_forecast
     WHERE series_id = ? AND forecast_date = 'latest'
     ORDER BY period`
  ).all(seriesId) as SteoRow[];
}

// ─── AAA Gas Prices ──────────────────────

export interface AaaStateRow {
  date: string;
  state: string;
  state_name: string;
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
}

export function getAaaStatePrices(): AaaStateRow[] {
  return cachedPrepare(
    `SELECT date, state, state_name, regular, midgrade, premium, diesel
     FROM aaa_state_prices
     WHERE date = (SELECT MAX(date) FROM aaa_state_prices)
     ORDER BY regular DESC`
  ).all() as AaaStateRow[];
}

export interface AaaCountyRow {
  date: string;
  state: string;
  county: string;
  price: number;
}

export function getAaaCountyPrices(state: string): AaaCountyRow[] {
  return cachedPrepare(
    `SELECT date, state, county, price
     FROM aaa_county_prices
     WHERE state = ? AND date = (SELECT MAX(date) FROM aaa_county_prices WHERE state = ?)
     ORDER BY price DESC`
  ).all(state, state) as AaaCountyRow[];
}
