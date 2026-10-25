import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../index.js';

const card = { property_id: 'source:1', price_inr: 24500000, built_up_area: 2000,
  sector: 'sector 104', match_percentage: 95.2, key_feature_tags: ['3 BHK', 'Luxury'],
  comparison_highlights: ['Same sector'] };
async function serve(client, run) {
  const server = createApp({ recommendationClient: client }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}/api/recommend`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: {
  'Content-Type': 'application/json', Origin: 'http://localhost:5173',
}, body: JSON.stringify(body) });

test('recommendation routes forward inputs, normalize cards, and allow frontend CORS', async () => {
  for (const endpoint of ['similar', 'contextual']) {
    const payload = endpoint === 'similar' ? { property_id: 0, top_n: 2 }
      : { sector: 'sector 104', price: 25000000, bedRoom: 3, built_up_area: 2000, luxury_category: 'Luxury', top_n: 2 };
    await serve({ request: async (config) => {
      assert.equal(config.url, `/api/v1/recommend/${endpoint}`);
      assert.equal(config.method, 'POST');
      assert.deepEqual(config.data, payload);
      return { data: [card, { ...card, price_inr: 8500000 }] };
    } }, async (base) => {
      const response = await post(`${base}/${endpoint}`, payload);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const cards = await response.json();
      assert.equal(cards[0].formatted_price, '\u20b92.45 Cr');
      assert.equal(cards[1].formatted_price, '\u20b985 Lakhs');
      assert.equal(cards[0].price_per_sqft, 12250);
      assert.deepEqual(cards[0].amenity_highlights, ['3 BHK', 'Luxury']);
      const preflight = await fetch(`${base}/${endpoint}`, { method: 'OPTIONS', headers: {
        Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST',
      } });
      assert.equal(preflight.status, 204);
    });
  }
});

test('recommendations return structured gateway errors for outages, timeouts, and bad responses', async () => {
  for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED']) {
    await serve({ request: async () => { throw { code }; } }, async (base) => {
      const response = await post(`${base}/similar`, { property_id: 0 });
      assert.equal(response.status, 502);
      const result = await response.json();
      assert.ok(result.error.message.includes('FastAPI'));
      assert.ok(result.error.request_id);
    });
  }
  for (const data of [{}, [{ ...card, built_up_area: 0 }], [{ ...card, match_percentage: Infinity }], [{ ...card, key_feature_tags: [1] }]]) {
    await serve({ request: async () => ({ data }) }, async (base) => {
      assert.equal((await post(`${base}/similar`, { property_id: 0 })).status, 502);
    });
  }
});

test('recommendations reject invalid inputs before proxying and preserve missing property errors', async () => {
  await serve({ request: async () => { assert.fail('must not proxy'); } }, async (base) => {
    for (const body of [{}, { property_id: true }, { property_id: 0, top_n: 0 }, { property_id: 0, extra: 1 }]) {
      assert.equal((await post(`${base}/similar`, body)).status, 422);
    }
    assert.equal((await post(`${base}/contextual`, { bedRoom: 2.5 })).status, 422);
  });
  await serve({ request: async () => { throw { response: { status: 404 } }; } }, async (base) => {
    assert.equal((await post(`${base}/similar`, { property_id: 'unknown' })).status, 404);
  });
  await serve({ request: async () => ({ data: [] }) }, async (base) => {
    assert.deepEqual(await (await post(`${base}/contextual`, {})).json(), []);
  });
});
