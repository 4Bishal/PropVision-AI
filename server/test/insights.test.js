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

test('insights routes forward filters and cache successful public snapshots', async () => {
  await serve(createApp({ ml: { getInsights: async (endpoint, query) => ({ endpoint, query }) } }), async (base) => {
    for (const endpoint of ['sector-rankings', 'summary-narratives', 'valuation-alerts']) {
      const response = await fetch(`${base}/api/insights/${endpoint}?property_type=house`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'public, max-age=60, must-revalidate');
      assert.deepEqual(await response.json(), { endpoint, query: { property_type: 'house' } });
    }
  });
});

test('insights service validates destinations, query shapes and response schemas', async () => {
  const service = createFastapiService({ client: { request: async ({ url }) => {
    assert.equal(url, '/insights/valuation-alerts?sector=sector+56&property_type=flat');
    return { data: { meta: { filtered_rows: 1 }, sectors: [], layout_comparisons: [], bedroom_comparisons: [], buyer_checklist: [] } };
  } } });
  await service.getInsights('valuation-alerts', { sector: 'sector 56', property_type: 'flat' });
  await assert.rejects(service.getInsights('unknown'), { status: 404 });
  await assert.rejects(service.getInsights('sector-rankings', { sector: 'sector 56' }), { status: 422 });
  await assert.rejects(service.getInsights('valuation-alerts', { sector: ['a', 'b'] }), { status: 422 });
  const malformed = createFastapiService({ client: { request: async () => ({ data: {} }) } });
  await assert.rejects(malformed.getInsights('sector-rankings'), { status: 502 });
});

test('insights outages and timeouts return errors without success cache headers', async () => {
  for (const [code, status] of [['ECONNREFUSED', 503], ['ETIMEDOUT', 504]]) {
    const ml = createFastapiService({ client: { request: async () => { throw { code }; } } });
    await serve(createApp({ ml }), async (base) => {
      const result = await fetch(`${base}/api/insights/sector-rankings`);
      assert.equal(result.status, status);
      assert.equal(result.headers.get('cache-control'), null);
      assert.ok((await result.json()).error.code);
    });
  }
});
