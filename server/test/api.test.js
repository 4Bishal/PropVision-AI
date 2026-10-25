import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createApp } from '../index.js';
import Property from '../models/Property.js';
import { createFastapiService, validatePrediction } from '../services/fastapiService.js';

const metadata = JSON.parse((await readFile(new URL('../../artifacts/tuned_v1/model_metadata.json', import.meta.url), 'utf8'))
  .replace(/:\s*NaN/g, ':null'));
const sample = metadata.example_payload;

function mockService(handler) {
  return createFastapiService({ client: { request: async (config) => {
    if (config.url === '/health') return { data: { status: 'healthy', metadata } };
    return handler(config);
  } } });
}

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
const post = (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

test('prediction validation preserves raw names and rejects coercion/missing/extras', () => {
  assert.deepEqual(validatePrediction(sample), sample);
  for (const patch of [{ bedRoom: true }, { bedRoom: '2' }, { bedRoom: 1.5 },
    { bathroom: 0 }, { built_up_area: Infinity }, { 'servant room': 2 },
    { balcony: 1 }, { sector: '' }, { floor_category: null }, { total_sqft: 200 }]) {
    assert.throws(() => validatePrediction({ ...sample, ...patch }), { status: 422 });
  }
  const missing = { ...sample }; delete missing['store room'];
  assert.throws(() => validatePrediction(missing), { status: 422 });
});


test('prediction forwards fields and returns Python INR without another inverse transform', async () => {
  const expected = { predicted_price_inr: 14_200_000, formatted_price: '₹1.42 Cr', log_prediction: 0.88 };
  const ml = mockService(async ({ url, data }) => {
    assert.equal(url, '/predict-price'); assert.deepEqual(data, sample); return { data: expected };
  });
  await withServer(createApp({ ml }), async (base) => {
    const response = await post(`${base}/api/predict`, sample);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), expected);
    assert.ok(response.headers.get('x-request-id'));
  });
});

test('schema metadata is dynamic and cached', async () => {
  let healthCalls = 0;
  const ml = createFastapiService({ client: { request: async () => {
    healthCalls++; return { data: { status: 'healthy', metadata } };
  } } });
  await withServer(createApp({ ml }), async (base) => {
    const result = await (await fetch(`${base}/api/schema-options`)).json();
    assert.deepEqual(result.sectors, metadata.categories.sector);
    assert.deepEqual(result.furnishing_types, metadata.categories.furnishing_type);
    await fetch(`${base}/api/schema-options`);
    assert.equal(healthCalls, 1);
  });
});

test('unseen category rejected before inference', async () => {
  const ml = mockService(() => { throw new Error('Must not call inference'); });
  await assert.rejects(ml.getPredictedPrice({ ...sample, sector: 'unknown' }), { status: 422 });
});

test('retired recommendation route is not exposed', async () => {
  await withServer(createApp(), async (base) => {
    assert.equal((await post(`${base}/api/recommend`, {})).status, 404);
  });
});

for (const [code, upstream, status] of [
  ['ECONNABORTED', undefined, 504], ['ETIMEDOUT', undefined, 504],
  ['ECONNREFUSED', undefined, 503], [undefined, 503, 503],
  [undefined, 500, 502], [undefined, 422, 422], [undefined, 404, 404],
]) {
  test(`upstream failure ${code || upstream} maps to ${status}`, async () => {
    const ml = mockService(async () => { throw Object.assign(new Error('secret upstream config'), {
      code, response: upstream ? { status: upstream, data: { detail: 'Rejected' } } : undefined,
    }); });
    await withServer(createApp({ ml }), async (base) => {
      const response = await post(`${base}/api/predict`, sample);
      assert.equal(response.status, status);
      assert.ok(!(await response.text()).includes('secret'));
    });
  });
}




test('invalid upstream data is a 502', async () => {
  await assert.rejects(mockService(async () => ({ data: { predicted_price_inr: -1 } }))
    .getPredictedPrice(sample), { status: 502 });
});

test('JSON errors, CORS, route 404 and global sanitization', async () => {
  await withServer(createApp({ ml: { getPredictedPrice: async () => { throw new Error('private'); } } }), async (base) => {
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    const invalid = await fetch(`${base}/api/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(invalid.status, 400);
    const cors = await fetch(`${base}/api/predict`, { method: 'OPTIONS', headers: {
      Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(cors.headers.get('access-control-allow-origin'), '*');
    const failure = await post(`${base}/api/predict`, sample);
    assert.equal(failure.status, 500); assert.ok(!(await failure.text()).includes('private'));
  });
});

test('Mongoose validates listing fields and GeoJSON longitude/latitude', async () => {
  const valid = { title: 'Apartment', sector: 'sector 5', property_type: 'flat', price_inr: 1e7,
    built_up_area: 1200, bedRoom: 2, bathroom: 2, furnishing_type: 'unfurnished',
    luxury_category: 'Standard', agePossession: 'New Property', image_url: 'https://example.com/home.jpg',
    location_coordinates: { type: 'Point', coordinates: [77, 28] } };
  await new Property(valid).validate();
  await assert.rejects(new Property({ ...valid, bedRoom: 1.5 }).validate());
  await assert.rejects(new Property({ ...valid, image_url: 'javascript:alert(1)' }).validate());
  await assert.rejects(new Property({ ...valid, location_coordinates: { coordinates: [200, 28] } }).validate());
});

test('real Axios transport applies timeout and sends JSON', async () => {
  const upstream = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') return res.end(JSON.stringify({ status: 'healthy', metadata }));
    let body = ''; for await (const chunk of req) body += chunk;
    assert.deepEqual(JSON.parse(body), sample);
    setTimeout(() => res.end('{}'), 200);
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  try {
    const ml = createFastapiService({ baseURL: `http://127.0.0.1:${upstream.address().port}`, timeout: 50 });
    await assert.rejects(ml.getPredictedPrice(sample), { status: 504 });
  } finally { await new Promise((resolve) => upstream.close(resolve)); }
});

test('prediction proxy preserves empirical interval and rejects corrupt bounds', async () => {
  const valuation_range = { lower_bound: 10000000, upper_bound: 16000000,
    confidence_level: '80% Empirical Prediction Interval', mae_pct: 19.48, q90_residual: .1687 };
  const result = { predicted_price_inr: 14200000, predicted_price: 14200000,
    formatted_price: 'INR 1.42 Cr', log_prediction: .88, valuation_range };
  const service = mockService(async () => ({ data: result }));
  assert.deepEqual((await service.getPredictedPrice(sample)).valuation_range, valuation_range);
  const malformed = mockService(async () => ({ data: { ...result,
    valuation_range: { ...valuation_range, lower_bound: 20000000 } } }));
  await assert.rejects(malformed.getPredictedPrice(sample), { status: 502 });
});
