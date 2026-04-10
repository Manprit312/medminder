import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function openSqlite(): Database.Database {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'medminder.db');
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      caregiver_email TEXT,
      caregiver_phone TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dosage_note TEXT,
      times_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      remaining_quantity INTEGER,
      pills_per_intake INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_medications_profile ON medications(profile_id);

    CREATE TABLE IF NOT EXISTS dose_logs (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      UNIQUE(medication_id, date, scheduled_time)
    );

    CREATE INDEX IF NOT EXISTS idx_dose_logs_date ON dose_logs(date);
  `);
  migrateMedicationsRefillColumns(db);
  migrateMedicationsKindColumn(db);
  migrateProfilesCaregiverColumns(db);
  migrateProfilesPatientGroupColumn(db);
  migratePasswordResetTokens(db);
  migrateUserSubscriptionTier(db);
  migrateCaretakerTables(db);
  return db;
}

function migratePasswordResetTokens(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
  `);
}

function migrateMedicationsRefillColumns(database: Database.Database) {
  const cols = database.prepare('PRAGMA table_info(medications)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('remaining_quantity')) {
    database.exec('ALTER TABLE medications ADD COLUMN remaining_quantity INTEGER');
  }
  if (!names.has('pills_per_intake')) {
    database.exec('ALTER TABLE medications ADD COLUMN pills_per_intake INTEGER NOT NULL DEFAULT 1');
  }
}

function migrateMedicationsKindColumn(database: Database.Database) {
  const cols = database.prepare('PRAGMA table_info(medications)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('kind')) {
    database.exec('ALTER TABLE medications ADD COLUMN kind TEXT');
  }
}

function migrateProfilesCaregiverColumns(database: Database.Database) {
  const cols = database.prepare('PRAGMA table_info(profiles)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('caregiver_email')) {
    database.exec('ALTER TABLE profiles ADD COLUMN caregiver_email TEXT');
  }
  if (!names.has('caregiver_phone')) {
    database.exec('ALTER TABLE profiles ADD COLUMN caregiver_phone TEXT');
  }
}

function migrateProfilesPatientGroupColumn(database: Database.Database) {
  const cols = database.prepare('PRAGMA table_info(profiles)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('patient_group')) {
    database.exec(`ALTER TABLE profiles ADD COLUMN patient_group TEXT NOT NULL DEFAULT 'adult'`);
  }
}

function migrateUserSubscriptionTier(database: Database.Database) {
  const cols = database.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('subscription_tier')) {
    database.exec(`ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'`);
  }
}

function migrateCaretakerTables(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS caretaker_invites (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      inviter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitee_email TEXT NOT NULL COLLATE NOCASE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_caretaker_invites_profile ON caretaker_invites(profile_id);
    CREATE INDEX IF NOT EXISTS idx_caretaker_invites_email ON caretaker_invites(invitee_email);

    CREATE TABLE IF NOT EXISTS caretaker_links (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      caretaker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, caretaker_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_caretaker_links_user ON caretaker_links(caretaker_user_id);
  `);
}
