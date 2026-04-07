import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import cors from 'cors';
import express, { type NextFunction } from 'express';
import helmet from 'helmet';
import { initDb } from './db.js';

/** Load `.env` whether you run from repo root or `backend/` (default dotenv only uses cwd). */
function loadEnvFile(): void {
  const cwd = process.cwd();
  const candidates = [path.join(cwd, '.env'), path.join(cwd, 'backend', '.env')];
  for (const p of candidates) {
    if (existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
  dotenv.config();
}
loadEnvFile();

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret || jwtSecret.length < 16) {
  console.error(
    '[medminder-api] Missing or short JWT_SECRET (need ≥16 characters).\n' +
      '  1. cd backend && cp .env.example .env\n' +
      '  2. Edit .env and set JWT_SECRET to a long random string.\n' +
      '  3. Restart the server.'
  );
  process.exit(1);
}
import { authRouter } from './routes/auth.js';
import { profilesRouter } from './routes/profiles.js';
import { medicationsRouter } from './routes/medications.js';
import { doseLogsRouter } from './routes/dose-logs.js';

const app = express();
const port = Number(process.env.PORT ?? 3847);

/** Behind nginx / Railway / Render: set TRUST_PROXY=1 so rate limits use real client IP. */
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}


/** Include Capacitor/Ionic native WebView origins (Android/iOS) so API calls are not blocked by CORS. */
const defaultCorsOrigins =
  'http://localhost:8100,http://localhost:4200,http://127.0.0.1:8100,' +
  'https://localhost,capacitor://localhost,ionic://localhost';
const origins = (process.env.CORS_ORIGINS ?? defaultCorsOrigins)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: origins.length ? origins : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '512kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'medminder-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/dose-logs', doseLogsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: NextFunction) => {
    console.error('[medminder-api]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

const host = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  await initDb();
  app.listen(port, host, () => {
    console.log(`MedMinder API listening on http://${host}:${port}`);
    console.log(`Health: GET http://localhost:${port}/health`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
