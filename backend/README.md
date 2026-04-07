# MedMinder API

Node.js + Express + TypeScript REST API with **JWT** auth.

- **Local development (default):** **SQLite** via `better-sqlite3` (`DATABASE_PATH`).
- **Production / cloud:** set **`DATABASE_URL`** to a **PostgreSQL** connection string (e.g. [Neon](https://neon.tech) free tier). The same code path runs on **Render**, **Railway**, **Fly.io**, etc.

## Deploy free (Render + Neon)

1. **Database — Neon (free PostgreSQL)**  
   - Create a project at [neon.tech](https://neon.tech), create a database, and copy the **connection string** (include `?sslmode=require`).  
   - Set it as **`DATABASE_URL`** on your host (do not commit it).

2. **API — Render (free web service)**  
   - Connect your Git repo to [Render](https://render.com).  
   - **Root Directory:** **`backend`** (folder with `package.json`, relative to repo root).  
   - Use the included **`render.yaml`** (Blueprint) or create a **Web Service** with **Build** `npm install && npm run build`, **Start** `npm start`.  
   - In **Environment**, add at least:
     - **`DATABASE_URL`** — Neon connection string  
     - **`JWT_SECRET`** — long random string (16+ characters)  
     - **`CORS_ORIGINS`** — comma-separated origins for your web app and Capacitor (e.g. `https://your-app.pages.dev`, `capacitor://localhost` if needed)  
     - **`APP_PUBLIC_URL`** — where users open the app (password-reset links), e.g. `https://your-app.pages.dev`  
   - **`TRUST_PROXY=1`** is set in `render.yaml`; keep it behind Render’s proxy for correct rate limits.  
   - After deploy, test **`GET https://<your-service>.onrender.com/health`**.

3. **Point the Ionic app** at the deployed API: set `apiUrl` in `src/environments/environment.prod.ts` (or your build config) to `https://<your-service>.onrender.com` (no trailing slash).

**Note:** Render’s free tier **spins down** after idle time; first request after sleep can take ~30–60 seconds.

**Build fails with a long `npm` help message:** In the Render service **Settings**, set **Build Command** to exactly:

`npm install && npm run build`

(not `npm` or empty). **Start Command:** `npm start`. If you use the repo’s `render.yaml` Blueprint, sync it so these commands are not overridden in the dashboard.

## Setup

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET (16+ characters), CORS_ORIGINS, and for production: SMTP_* + APP_PUBLIC_URL
npm install
npm run build
JWT_SECRET=your-long-secret-here npm start
```

Development (auto-reload):

```bash
npm run dev
```

Default URL: `http://localhost:3847` (or `PORT` from `.env`).

## Health

- `GET /health` — no auth

## Auth

| Method | Path | Body | Notes |
|--------|------|------|--------|
| POST | `/api/auth/register` | `{ "email", "password" }` (password ≥ 8 chars) | Returns `{ token, user }` |
| POST | `/api/auth/login` | `{ "email", "password" }` | Returns `{ token, user }` |
| POST | `/api/auth/forgot-password` | `{ "email" }` | Sends reset email (if SMTP configured). Same response whether or not email exists. Rate limited. |
| POST | `/api/auth/reset-password` | `{ "token", "password" }` (password ≥ 8 chars) | One-time token from email link (1 hour). |
| GET | `/api/auth/me` | — | Header: `Authorization: Bearer <token>` |

### Password reset (production)

1. Set **`APP_PUBLIC_URL`** to the URL where users open the Ionic app (e.g. `https://app.example.com`). Reset links use `/reset-password?token=…`.
2. Configure **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASS`**, and **`EMAIL_FROM`** so the API can send mail.
3. Add your app origin to **`CORS_ORIGINS`**.
4. If the API runs behind nginx / Railway / Render, set **`TRUST_PROXY=1`** so forgot-password rate limits use the real client IP.

### Local dev without SMTP

- Forgot-password still creates a token; the **reset URL is printed in the server console**.
- Set **`DEV_EXPOSE_RESET_URL=true`** to also return `devResetUrl` in the JSON (testing only; never in production).

## Docker

Build and run (persist DB on a volume):

```bash
docker build -t medminder-api .
docker run --rm -p 3847:3847 \
  -e JWT_SECRET=your-long-secret-here \
  -e DATABASE_PATH=/data/medminder.db \
  -e APP_PUBLIC_URL=http://localhost:8100 \
  -e CORS_ORIGINS=http://localhost:8100 \
  -v medminder-data:/data \
  medminder-api
```

Pass `SMTP_*` and `APP_PUBLIC_URL` for production.

## Deployment checklist

- [ ] **`DATABASE_URL`** set to PostgreSQL (e.g. Neon) in production, **or** **`DATABASE_PATH`** on a persistent volume if you stay on SQLite.
- [ ] Strong **`JWT_SECRET`** (16+ characters).
- [ ] **`CORS_ORIGINS`** includes your web app origin(s).
- [ ] **`APP_PUBLIC_URL`** matches where the SPA is hosted.
- [ ] **`SMTP_*`** for password reset emails (or accept console-only reset in dev).
- [ ] **`TRUST_PROXY=1`** if behind a reverse proxy (Render/Railway).

## Profiles (Bearer required)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/profiles` | — (includes optional `caregiverEmail`, `caregiverPhone` per profile) |
| POST | `/api/profiles` | `{ "name", "caregiverEmail"?, "caregiverPhone"? }` |
| GET | `/api/profiles/:id` | — |
| PATCH | `/api/profiles/:id` | `{ "name", "caregiverEmail"?, "caregiverPhone"? }` — omit caregiver fields to leave unchanged |
| DELETE | `/api/profiles/:id` | — |
| GET | `/api/profiles/:id/medications` | — |
| POST | `/api/profiles/:id/medications` | `{ "name", "times": ["08:00","20:00"], "dosageNote"?, "enabled"?, "remainingQuantity"?, "pillsPerIntake"? }` — `remainingQuantity` is pills on hand (omit or null to skip tracking); `pillsPerIntake` defaults to 1 (pills deducted per dose marked **taken**) |

## Medications (Bearer required)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/medications/:id` | — |
| PATCH | `/api/medications/:id` | any of `{ "name", "times", "dosageNote", "enabled", "remainingQuantity", "pillsPerIntake" }` — send `remainingQuantity: null` to clear pill tracking |
| DELETE | `/api/medications/:id` | — |

## Dose logs (Bearer required)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/dose-logs?date=YYYY-MM-DD` | Logs for that calendar date |
| GET | `/api/dose-logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | Logs in range (inclusive), ordered by date and time |
| POST | `/api/dose-logs` | `{ "medicationId", "date", "scheduledTime", "status": "taken" \| "skipped" \| "missed" }` — upserts; when status changes to/from **taken**, `remaining_quantity` is adjusted by `pills_per_intake` if tracking is enabled |

## Ionic app

The mobile app still uses **local Capacitor Preferences** by default. To use this API, add `HttpClient`, store `token` after login, and send `Authorization: Bearer …` on requests. Point the base URL at this server (and add that origin to `CORS_ORIGINS`).
