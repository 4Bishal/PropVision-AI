import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { createApiRouter } from './routes/api.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createInsightsRouter } from './routes/insights.js';
import recommendRoutes from './routes/recommend.js';
import * as fastapiService from './services/fastapiService.js';
import { AppError, errorHandler } from './lib/errors.js';

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });

export function createApp(dependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { req.id = randomUUID(); res.set('X-Request-ID', req.id); next(); });
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8',
    legacyHeaders: false, handler: (req, res) => res.status(429).json({ error: {
      code: 'RATE_LIMITED', message: 'Too many requests', request_id: req.id } }) }));
  app.use('/api', createApiRouter(dependencies));
  app.use('/api/analytics', createAnalyticsRouter(dependencies));
  app.use('/api/insights', createInsightsRouter(dependencies));
  app.use('/api/recommend', recommendRoutes(dependencies));
  app.get('/api/health', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await (dependencies?.ml || fastapiService).getServiceHealth());
  });
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return app;
}

export async function start() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required; configure server/.env');
  const port = Number(process.env.PORT || 5000);
  const timeout = Number(process.env.FASTAPI_TIMEOUT_MS || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120000) throw new Error('FASTAPI_TIMEOUT_MS must be 1..120000');
  const url = new URL(process.env.FASTAPI_URL || 'http://localhost:8000');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid FASTAPI_URL');
  mongoose.set('bufferCommands', false);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000, socketTimeoutMS: 10000, maxPoolSize: 10,
    autoIndex: process.env.NODE_ENV !== 'production' });
  const app = createApp();
  const server = app.listen(port, process.env.HOST || '127.0.0.1');
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  } catch (error) { await mongoose.disconnect(); throw error; }
  console.log(`PropVision API listening on port ${port}`);
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 15000);
    deadline.unref();
    server.close(async () => {
      try { await mongoose.disconnect(); clearTimeout(deadline); process.exitCode = 0; }
      catch { process.exitCode = 1; }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  mongoose.connection.on('error', () => console.error('MongoDB connection error'));
  return { app, server };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  start().catch((error) => {
    console.error(error.message?.includes('required') ? error.message : 'Server startup failed; check configuration and MongoDB connectivity');
    process.exitCode = 1;
  });
}
