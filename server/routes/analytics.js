import { Router } from 'express';
import * as fastapiService from '../services/fastapiService.js';

export function createAnalyticsRouter({ ml = fastapiService } = {}) {
  const router = Router();
  for (const endpoint of ['kpis', 'geospatial', 'sector-breakdown', 'feature-correlations',
    'floor-price-density', 'utility-room-premium', 'balcony-distribution', 'luxury-vs-possession']) {
    router.get(`/${endpoint}`, async (req, res) => {
      // Filters travel unchanged to the snapshot engine; upstream failures use
      // the shared timeout/error middleware, never fabricated zero statistics.
      res.json(await ml.getAnalytics(endpoint, req.query));
    });
  }
  return router;
}

export default createAnalyticsRouter();
