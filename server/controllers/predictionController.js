import * as fastapiService from '../services/fastapiService.js';

export function createPredictionController({ ml = fastapiService } = {}) {
  async function handlePrediction(req, res) {
    const prediction = await ml.getPredictedPrice(req.body);
    // Predictions need no database write; query logging is intentionally optional.
    res.json(prediction);
  }

  async function handleSchemaOptions(req, res) {
    res.json(await ml.getSchemaOptions());
  }
  return { handlePrediction, handleSchemaOptions };
}

export const { handlePrediction, handleSchemaOptions } = createPredictionController();
