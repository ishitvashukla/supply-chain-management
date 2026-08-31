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

app.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Door API', docs: '/api/v1/health' });
});

app.use('/api/v1', routes);

// Order matters: unmatched routes first, then the global error handler last.
app.use(notFound);
app.use(errorHandler);

export default app;
