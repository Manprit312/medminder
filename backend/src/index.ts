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


/**
 * Default Helmet sets Cross-Origin-Resource-Policy: same-origin, which can block
 * Capacitor/WebView from reading JSON from another origin (CORS passes but the
 * response is still blocked) — Angular shows HTTP status 0. Public APIs should
 * use cross-origin CORP.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const allowedOrigins = ['http://localhost', 'capacitor://localhost'];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, true); // TEMP allow all (debug)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors());

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

function isPgForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23503'
  );
}

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: NextFunction) => {
    if (isPgForeignKeyViolation(err)) {
      console.error(
        '[medminder-api] FK violation — user id in token missing from DB (sign out + sign in after switching API/DB):',
        err
      );
      res.status(401).json({
        error:
          'Your session does not match this server database. Sign out in the app, then sign in or register again.',
      });
      return;
    }
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
