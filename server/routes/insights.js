import { Router } from 'express';
import * as fastapiService from '../services/fastapiService.js';

export function createInsightsRouter({ ml = fastapiService } = {}) {
  const router = Router();
  for (const endpoint of ['sector-rankings', 'valuation-alerts', 'summary-narratives']) {
    router.get(`/${endpoint}`, async (req, res) => {
      // Cache successful public snapshot responses only. Shared middleware handles
      // outages/timeouts; no invented advisory or stale success replaces an error.
      const result = await ml.getInsights(endpoint, req.query);
      res.set('Cache-Control', 'public, max-age=60, must-revalidate');
      res.json(result);
    });
  }
  return router;
}
