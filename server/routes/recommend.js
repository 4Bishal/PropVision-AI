import { Router } from 'express';
import axios from 'axios';
import { AppError } from '../lib/errors.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const invalid = (message) => new AppError(422, 'INVALID_INPUT', message);
const badResponse = () => new AppError(502, 'ML_INVALID_RESPONSE', 'Recommendation service returned invalid property data');

function validateBody(body, endpoint) {
  const fields = endpoint === 'similar'
    ? ['property_id', 'top_n', 'max_price_diff_pct']
    : ['sector', 'price', 'bedRoom', 'built_up_area', 'luxury_category', 'top_n', 'budget', 'min_price', 'max_price'];
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Body must be an object');
  if (Object.keys(body).some((key) => !fields.includes(key))) throw invalid('Unsupported input fields');
  const result = { ...body, top_n: body.top_n ?? 6 };
  if (!Number.isSafeInteger(result.top_n) || result.top_n < 1 || result.top_n > 100) {
    throw invalid('top_n must be an integer between 1 and 100');
  }
  if (endpoint === 'similar') {
    const id = body.property_id;
    if (!(Number.isSafeInteger(id) && id >= 0) && !(typeof id === 'string' && id.trim() && id.length <= 200)) {
      throw invalid('property_id must be a nonnegative integer or stable property ID');
    }
    if (typeof id === 'string') result.property_id = id.trim();
    if (body.max_price_diff_pct !== undefined && (!finite(body.max_price_diff_pct) || body.max_price_diff_pct < 0)) {
      throw invalid('max_price_diff_pct must be finite and nonnegative');
    }
  } else {
    for (const field of ['sector', 'luxury_category']) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string' || !body[field].trim() || body[field].length > 200) throw invalid(`${field} must be a nonempty string`);
        result[field] = body[field].trim();
      }
    }
    for (const field of ['price', 'bedRoom', 'built_up_area', 'budget', 'min_price', 'max_price']) {
      if (body[field] !== undefined && (!finite(body[field]) || body[field] <= 0
          || (field === 'bedRoom' && !Number.isSafeInteger(body[field])))) throw invalid(`${field} must be a positive ${field === 'bedRoom' ? 'integer' : 'finite number'}`);
    }
    if (body.min_price > (body.max_price ?? body.budget ?? Infinity)) throw invalid('min_price exceeds maximum budget');
  }
  return result;
}

export function normalizeRecommendations(data) {
  if (!Array.isArray(data) || data.length > 100) throw badResponse();
  return data.map((card) => {
    if (!card || typeof card !== 'object') throw badResponse();
    const price = card.price_inr ?? card.price;
    const area = card.built_up_area ?? card.area;
    const tags = card.key_feature_tags ?? [];
    const highlights = card.comparison_highlights ?? [];
    if (!(typeof card.property_id === 'string' && card.property_id.trim())
        && !(Number.isSafeInteger(card.property_id) && card.property_id >= 0)) throw badResponse();
    if (!finite(price) || price <= 0 || !finite(area) || area <= 0
        || !finite(price / area) || !finite(card.match_percentage)
        || (card.vector_match_percentage !== undefined && (!finite(card.vector_match_percentage) || Math.abs(card.vector_match_percentage) > 100))
        || card.match_percentage < 0 || card.match_percentage > 100
        || typeof card.sector !== 'string' || !card.sector.trim()
        || ![tags, highlights].every((list) => Array.isArray(list) && list.every((tag) => typeof tag === 'string' && tag.trim()))) throw badResponse();
    const amount = price >= 1e7 ? price / 1e7 : price / 1e5;
    const formatted = `₹${Number(amount.toFixed(2))} ${price >= 1e7 ? 'Cr' : 'Lakhs'}`;
    return { ...card, price, price_inr: price, price_crore: price / 1e7,
      formatted_price: formatted, area, built_up_area: area,
      price_per_sqft: Math.round(price / area * 100) / 100,
      key_feature_tags: [...new Set(tags)], amenity_highlights: [...new Set(tags)],
      comparison_highlights: [...new Set(highlights)] };
  });
}

export function createRecommendRouter({ recommendationClient } = {}) {
  const router = Router();
  // Construct lazily so dotenv and runtime configuration are already loaded.
  const http = recommendationClient ?? axios.create({
    baseURL: process.env.FASTAPI_URL || 'http://127.0.0.1:8000',
    timeout: Number(process.env.FASTAPI_TIMEOUT_MS || 10000), proxy: false,
    maxRedirects: 0, maxContentLength: 2 * 1024 * 1024, maxBodyLength: 32 * 1024,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  for (const endpoint of ['similar', 'contextual']) {
    router.post(`/${endpoint}`, async (req, res, next) => {
      try {
        const data = validateBody(req.body, endpoint);
        const response = await http.request({ method: 'POST', url: `/api/v1/recommend/${endpoint}`, data });
        const cards = normalizeRecommendations(response.data);
        if (cards.length > data.top_n) throw badResponse();
        res.set('Cache-Control', 'no-store');
        res.json(cards);
      } catch (error) {
        if (error instanceof AppError) return next(error);
        const status = error.response?.status;
        if ([400, 404, 422].includes(status)) {
          return next(new AppError(status, 'ML_REQUEST_REJECTED', status === 404 ? 'Property not found' : 'Recommendation service rejected the input'));
        }
        const timeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code);
        return next(new AppError(502, timeout ? 'ML_TIMEOUT' : 'ML_UNAVAILABLE', timeout
          ? 'FastAPI recommendation service timed out' : 'FastAPI recommendation service is unavailable or failed; check the Python service on port 8000'));
      }
    });
  }
  return router;
}

export default createRecommendRouter;
