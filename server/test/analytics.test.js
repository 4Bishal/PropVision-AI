import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../index.js';
import { createFastapiService } from '../services/fastapiService.js';

async function serve(app, run) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('all eight analytics routes proxy query filters', async () => {
  const ml = { getAnalytics: async (endpoint, query) => ({ endpoint, query }) };
  await serve(createApp({ ml }), async (base) => {
    for (const endpoint of ['kpis', 'geospatial', 'sector-breakdown', 'feature-correlations', 'floor-price-density', 'utility-room-premium', 'balcony-distribution', 'luxury-vs-possession']) {
      const response = await fetch(`${base}/api/analytics/${endpoint}?property_type=house&luxury_category=Luxury`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { endpoint, query: { property_type: 'house', luxury_category: 'Luxury' } });
    }
  });
});

test('analytics service forwards only fixed endpoints and encoded parameters', async () => {
  const ml = createFastapiService({ client: { request: async ({ method, url }) => {
    assert.equal(method, 'GET');
    assert.equal(url, '/analytics/sector-breakdown?property_type=flat&sector=sector+56&limit=15');
    return { data: { meta: { filtered_rows: 4 }, sectors: [] } };
  } } });
  await ml.getAnalytics('sector-breakdown', { property_type: 'flat', sector: 'sector 56', limit: '15' });
  await assert.rejects(ml.getAnalytics('unknown'), { status: 404 });
  await assert.rejects(ml.getAnalytics('kpis', { url: 'https://example.com' }), { status: 422 });
  await assert.rejects(ml.getAnalytics('kpis', { sector: ['a', 'b'] }), { status: 422 });
});

test('analytics outage returns 503 instead of fake zero data', async () => {
  const ml = createFastapiService({ client: { request: async () => { throw { code: 'ECONNREFUSED' }; } } });
  await serve(createApp({ ml }), async (base) => {
    const response = await fetch(`${base}/api/analytics/kpis`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'ML_UNAVAILABLE');
  });
});

test('health is uncached and distinguishes Express from FastAPI availability', async () => {
  const ml = createFastapiService({ client: { request: async () => { throw { code: 'ECONNREFUSED' }; } } });
  await serve(createApp({ ml }), async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual({ ...(await response.json()), checked_at: null }, { express: 'online', fastapi: 'offline', checked_at: null });
  });
});

test('malformed analytics payloads are rejected', async () => {
  const ml = createFastapiService({ client: { request: async () => ({ data: { sectors: [] } }) } });
  await assert.rejects(ml.getAnalytics('geospatial'), { status: 502 });
});
