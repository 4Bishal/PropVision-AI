import axios from 'axios';
import { AppError } from '../lib/errors.js';

export const FEATURE_COLUMNS = ['property_type', 'sector', 'bedRoom', 'bathroom',
  'balcony', 'agePossession', 'built_up_area', 'servant room', 'store room',
  'furnishing_type', 'floor_category', 'luxury_category'];
const NUMERIC = new Set(['bedRoom', 'bathroom', 'built_up_area', 'servant room', 'store room']);
const invalid = (message, details) => new AppError(422, 'INVALID_INPUT', message, details);
const badResponse = () => new AppError(502, 'ML_INVALID_RESPONSE', 'ML service returned an incompatible response');
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const integer = (value) => Number.isSafeInteger(value);

function bodyObject(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw invalid('Body must be an object');
  const extras = Object.keys(data).filter((key) => !fields.includes(key));
  if (extras.length) throw invalid('Unsupported input fields', { fields: extras });
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw invalid(`${field} must be a nonempty string of at most 200 characters`);
  }
  return value.trim();
}

export function validatePrediction(data) {
  bodyObject(data, FEATURE_COLUMNS);
  const result = {};
  for (const field of FEATURE_COLUMNS) {
    const value = data[field];
    if (!NUMERIC.has(field)) result[field] = text(value, field);
    else {
      const binary = field === 'servant room' || field === 'store room';
      if (!finite(value) || (binary ? ![0, 1].includes(value) : value <= 0)
          || (field !== 'built_up_area' && !integer(value))) {
        throw invalid(`${field} must be ${binary ? '0 or 1' : field === 'built_up_area'
          ? 'a finite positive number in square feet' : 'a positive integer'}`);
      }
      result[field] = value;
    }
  }
  return result;
}

export function createFastapiService({ baseURL = 'http://localhost:8000', timeout = 10000,
  cacheTtlMs = 60000, client } = {}) {
  const http = client ?? axios.create({ baseURL, timeout, proxy: false,
    maxRedirects: 0, maxContentLength: 2 * 1024 * 1024, maxBodyLength: 32 * 1024,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  let cached;
  let expires = 0;
  let pending;

  async function request(method, url, data) {
    try { return (await http.request({ method, url, data })).data; }
    catch (error) {
      if (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) {
        throw new AppError(504, 'ML_TIMEOUT', 'ML service timed out');
      }
      const status = error.response?.status;
      if ([400, 404, 422].includes(status)) {
        const detail = error.response?.data?.detail;
        // Forward only structured validation information, never Axios internals.
        const details = Array.isArray(detail) ? detail.map(({ loc, msg, type, allowed }) =>
          ({ loc, msg, type, ...(allowed ? { allowed } : {}) }))
          : typeof detail === 'string' ? detail : undefined;
        throw new AppError(status, 'ML_REQUEST_REJECTED', 'ML service rejected the request', details);
      }
      if (!error.response || status === 503) {
        throw new AppError(503, 'ML_UNAVAILABLE', 'ML service is unavailable');
      }
      throw new AppError(502, 'ML_UPSTREAM_ERROR', 'ML service failed to process the request');
    }
  }

  async function getSchemaOptions() {
    if (cached && Date.now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const health = await request('GET', '/health');
      const metadata = health?.metadata;
      if (health?.status !== 'healthy' || metadata?.schema_version !== 'propvision-tuned-v1'
          || metadata.target_transform !== 'log1p' || metadata.target_unit !== 'crore'
          || JSON.stringify(metadata.feature_columns) !== JSON.stringify(FEATURE_COLUMNS)) throw badResponse();
      const categories = {};
      for (const field of FEATURE_COLUMNS.filter((f) => !NUMERIC.has(f))) {
        const values = metadata.categories?.[field];
        if (!Array.isArray(values) || !values.length || !values.every((v) => typeof v === 'string' && v.length)) throw badResponse();
        categories[field] = [...values];
      }
      cached = { schema_version: metadata.schema_version, feature_columns: [...FEATURE_COLUMNS],
        categories, sectors: categories.sector, furnishing_types: categories.furnishing_type,
        luxury_categories: categories.luxury_category, units: { price: 'INR', built_up_area: 'sqft' } };
      expires = Date.now() + cacheTtlMs;
      return cached;
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  async function checkCategories(values) {
    const options = await getSchemaOptions();
    for (const [field, allowed] of Object.entries(options.categories)) {
      if (Object.hasOwn(values, field) && !allowed.includes(values[field])) {
        throw invalid(`Unsupported ${field}`, { field, allowed });
      }
    }
  }

  async function getPredictedPrice(propertyData) {
    const payload = validatePrediction(propertyData);
    await checkCategories(payload);
    // React -> Express validation -> unchanged raw fields -> fitted Python pipeline.
    const result = await request('POST', '/predict-price', payload);
    if (!finite(result?.predicted_price_inr) || result.predicted_price_inr < 0
        || !finite(result.log_prediction) || typeof result.formatted_price !== 'string') throw badResponse();
    const interval = result.valuation_range;
    if (interval != null && (!finite(interval.lower_bound) || !finite(interval.upper_bound)
        || interval.lower_bound < 0 || interval.upper_bound < interval.lower_bound
        || !finite(interval.mae_pct) || interval.mae_pct < 0
        || (interval.q90_residual !== undefined && !finite(interval.q90_residual))
        || interval.confidence_level !== '80% Empirical Prediction Interval')) throw badResponse();
    return { ...(result.predicted_price !== undefined ? { predicted_price: result.predicted_price } : {}),
      ...(interval != null ? { valuation_range: { lower_bound: interval.lower_bound,
        upper_bound: interval.upper_bound, confidence_level: interval.confidence_level, mae_pct: interval.mae_pct,
        ...(interval.q90_residual !== undefined ? { q90_residual: interval.q90_residual } : {}) } } : {}),
      predicted_price_inr: result.predicted_price_inr,
      formatted_price: result.formatted_price, log_prediction: result.log_prediction };
  }

  async function getServiceHealth() {
    try {
      const health = await request('GET', '/health');
      return { express: 'online', fastapi: health?.status === 'healthy' ? 'online' : 'offline',
        checked_at: new Date().toISOString() };
    } catch {
      return { express: 'online', fastapi: 'offline', checked_at: new Date().toISOString() };
    }
  }

  async function getAnalytics(endpoint, query = {}) {
    if (!['kpis', 'geospatial', 'sector-breakdown', 'feature-correlations',
    'floor-price-density', 'utility-room-premium', 'balcony-distribution', 'luxury-vs-possession'].includes(endpoint)) {
      throw new AppError(404, 'NOT_FOUND', 'Analytics endpoint not found');
    }
    const allowed = ['property_type', 'luxury_category', 'sector',
      ...(endpoint === 'sector-breakdown' ? ['sort_by', 'limit'] : [])];
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (!allowed.includes(key) || typeof value !== 'string') throw invalid('Invalid analytics query parameter', { field: key });
      params.set(key, value);
    }
    const result = await request('GET', `/analytics/${endpoint}${params.size ? `?${params}` : ''}`);
    const collection = { geospatial: 'sectors', 'sector-breakdown': 'sectors', 'feature-correlations': 'price_vs_area',
      'floor-price-density': 'groups', 'utility-room-premium': 'groups',
      'balcony-distribution': 'groups', 'luxury-vs-possession': 'cells' }[endpoint];
    if (!result?.meta || !Number.isInteger(result.meta.filtered_rows)
        || (collection && !Array.isArray(result[collection]))
        || (endpoint === 'kpis' && !Number.isInteger(result.total_listings))) throw badResponse();
    return result;
  }

  async function getInsights(endpoint, query = {}) {
    const collections = { 'sector-rankings': 'sectors', 'valuation-alerts': 'layout_comparisons', 'summary-narratives': 'bullets' };
    if (!Object.hasOwn(collections, endpoint)) throw new AppError(404, 'NOT_FOUND', 'Insights endpoint not found');
    const allowed = ['property_type', ...(endpoint === 'valuation-alerts' ? ['sector'] : [])];
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (!allowed.includes(key) || typeof value !== 'string' || !value.trim() || value.length > 200) {
        throw invalid('Invalid insights query parameter', { field: key });
      }
      params.set(key, value);
    }
    const result = await request('GET', `/insights/${endpoint}${params.size ? `?${params}` : ''}`);
    if (!Number.isInteger(result?.meta?.filtered_rows) || !Array.isArray(result[collections[endpoint]])
        || (endpoint === 'valuation-alerts' && (!Array.isArray(result.sectors) || !Array.isArray(result.buyer_checklist) || !Array.isArray(result.bedroom_comparisons)))
        || (endpoint === 'sector-rankings' && !Array.isArray(result.limited_sample_sectors))
        || (endpoint === 'summary-narratives' && !Array.isArray(result.takeaways))) throw badResponse();
    return result;
  }

  return { getPredictedPrice, getSchemaOptions, getAnalytics, getInsights, getServiceHealth };
}

// Lazily instantiate so dotenv configuration is loaded before reading env vars.
let service;
function configuredService() {
  service ??= createFastapiService({ baseURL: process.env.FASTAPI_URL || 'http://localhost:8000',
    timeout: Number(process.env.FASTAPI_TIMEOUT_MS || 10000) });
  return service;
}
export const getPredictedPrice = (data) => configuredService().getPredictedPrice(data);
export const getSchemaOptions = () => configuredService().getSchemaOptions();
export const getAnalytics = (endpoint, query) => configuredService().getAnalytics(endpoint, query);
export const getServiceHealth = () => configuredService().getServiceHealth();
export const getInsights = (endpoint, query) => configuredService().getInsights(endpoint, query);
