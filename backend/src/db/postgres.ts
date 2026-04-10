import pg from 'pg';

const SCHEMA_STATEMENTS = [
  `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email))`,
  `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  caregiver_email TEXT,
  caregiver_phone TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id)`,
  `
CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage_note TEXT,
  times_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  remaining_quantity INTEGER,
  pills_per_intake INTEGER NOT NULL DEFAULT 1
)`,
  `CREATE INDEX IF NOT EXISTS idx_medications_profile ON medications(profile_id)`,
  `
CREATE TABLE IF NOT EXISTS dose_logs (
  id TEXT PRIMARY KEY,
  medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  CONSTRAINT dose_logs_med_date_time_uniq UNIQUE (medication_id, date, scheduled_time)
)`,
  `CREATE INDEX IF NOT EXISTS idx_dose_logs_date ON dose_logs(date)`,
  `
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)`,
];

const MIGRATIONS = [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS caregiver_email TEXT`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS caregiver_phone TEXT`,
  `ALTER TABLE medications ADD COLUMN IF NOT EXISTS remaining_quantity INTEGER`,
  `ALTER TABLE medications ADD COLUMN IF NOT EXISTS pills_per_intake INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE medications ADD COLUMN IF NOT EXISTS kind TEXT`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS patient_group TEXT NOT NULL DEFAULT 'adult'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'`,
  `
CREATE TABLE IF NOT EXISTS caretaker_invites (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inviter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_caretaker_invites_profile ON caretaker_invites(profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_caretaker_invites_email_lower ON caretaker_invites(LOWER(invitee_email))`,
  `
CREATE TABLE IF NOT EXISTS caretaker_links (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  caretaker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, caretaker_user_id)
)`,
  `CREATE INDEX IF NOT EXISTS idx_caretaker_links_user ON caretaker_links(caretaker_user_id)`,
];

export async function createPgPool(connectionString: string): Promise<pg.Pool> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  for (const sql of SCHEMA_STATEMENTS) {
    await pool.query(sql);
  }
  for (const sql of MIGRATIONS) {
    await pool.query(sql);
  }
  return pool;
}
