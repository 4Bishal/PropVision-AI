import { Router } from 'express';
import { createPredictionController } from '../controllers/predictionController.js';

export function createApiRouter(dependencies) {
  const router = Router();
  const controller = createPredictionController(dependencies);
  router.post('/predict', controller.handlePrediction);
  router.get('/schema-options', controller.handleSchemaOptions);
  return router;
}

export default createApiRouter();
