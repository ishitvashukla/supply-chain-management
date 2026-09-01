import path from 'node:path';
import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler, notFound } from './middlewares';
import env from './config/env';

const app: Application = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
// Above MAX_IMAGE_BYTES (2MB) plus base64 and JSON overhead, so an oversized
// image is rejected by the validator with a useful message rather than by the
// body parser with "request entity too large".
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/api/v1', routes);

/**
 * In production the built frontend is served from this same process, so the
 * whole app deploys as one unit and the browser is always same-origin with the
 * API — no CORS, one URL, one certificate.
 *
 * Mounted after the API so a route like /api/v1/orders is never swallowed by
 * the SPA fallback, and before the 404 handler so unknown paths reach index.html.
 */
const clientDir = env.clientDir;

if (clientDir) {
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));

  app.get('/{*splat}', (req: Request, res: Response, next) => {
    // Anything under /api is the API's to answer, including its 404s.
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDir, 'index.html'));
  });
} else {
  app.get('/', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Door API', docs: '/api/v1/health' });
  });
}

// Order matters: unmatched routes first, then the global error handler last.
app.use(notFound);
app.use(errorHandler);

export default app;
