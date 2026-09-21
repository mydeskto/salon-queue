import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import morgan from 'morgan';
import { env } from './env';
import { HttpError } from './lib/errors';
import { appointmentsRouter } from './routes/appointments';
import { authRouter } from './routes/auth';
import { billsRouter } from './routes/bills';
import { chairsRouter } from './routes/chairs';
import { employeesRouter } from './routes/employees';
import { kioskRouter } from './routes/kiosk';
import { reportsRouter } from './routes/reports';
import { salonsRouter } from './routes/salons';
import { servicesRouter } from './routes/services';
import { staffRouter } from './routes/staff';
import { tokensRouter } from './routes/tokens';
import { UPLOADS_DIR, uploadsRouter } from './routes/uploads';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, printing: env.escpos.enabled });
  });

  // Salon branding photos/logos, served statically after upload via /api/uploads.
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.use('/api/auth', authRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/kiosk', kioskRouter);
  app.use('/api/salons', salonsRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/chairs', chairsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/tokens', tokensRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/bills', billsRouter);
  app.use('/api/reports', reportsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, details: error.details });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
