-- ─────────────────────────────────────────────────────────────
-- MedMinder — demo / screenshot seed  (safe UPDATEs only)
-- Run: sqlite3 backend/data/medminder.db < scripts/seed-demo-data.sql
-- ─────────────────────────────────────────────────────────────

-- ── 1. Profile names ─────────────────────────────────────────
UPDATE profiles SET name = 'Mom'       WHERE id = '9d90b468-9905-4ba2-bf9f-f3c659970777';
UPDATE profiles SET name = 'Manprit'   WHERE id = '7f5e1c87-e1ba-4d7c-a517-c75107dde2a3';
UPDATE profiles SET name = 'Dad'       WHERE id = 'eba6aa9c-94a8-4a31-9464-50f1d4bbc705';
UPDATE profiles SET name = 'Grandma'   WHERE id = '0064cc32-c3a6-4e77-8f20-7e43e444364e';

-- ── 2. Medication names + dosage notes + kind ────────────────
-- Manprit's meds
UPDATE medications SET
  name = 'Vitamin D3',
  dosage_note = '60,000 IU · Once a week (Sunday)',
  kind = 'tablet',
  times_json = '["08:00"]'
WHERE id = '8a155e12-14ee-452a-b105-1b03782c38d6';

UPDATE medications SET
  name = 'Cetirizine',
  dosage_note = '10 mg · Once daily at night',
  kind = 'tablet',
  times_json = '["21:00"]'
WHERE id = '252e20e7-96f4-45f2-bc4c-07cba9ca47fc';

UPDATE medications SET
  name = 'Omega-3 Fish Oil',
  dosage_note = '1000 mg · Twice daily with meals',
  kind = 'capsule',
  times_json = '["08:00","13:00"]'
WHERE id = '74a0aab2-9d6a-49bc-8442-6b9dcf8f1901';

UPDATE medications SET
  name = 'Ashwagandha',
  dosage_note = '300 mg extract · Morning',
  kind = 'capsule',
  times_json = '["08:30"]'
WHERE id = '90b6fdcc-03c8-4582-9f3b-a6d560ec97bd';

UPDATE medications SET
  name = 'Magnesium Glycinate',
  dosage_note = '400 mg · Before bed',
  kind = 'tablet',
  times_json = '["22:00"]'
WHERE id = '85de1cd3-9bf5-4077-a924-eaa64f6c3bc4';

UPDATE medications SET
  name = 'Probiotic LGG',
  dosage_note = '10 Billion CFU · With breakfast',
  kind = 'capsule',
  times_json = '["08:00"]'
WHERE id = '136f34cc-9e65-424f-89ab-178bf5fc7ac9';

-- Mom's med
UPDATE medications SET
  name = 'Amlodipine',
  dosage_note = '5 mg · Once daily (blood pressure)',
  kind = 'tablet',
  times_json = '["09:00"]'
WHERE id = 'dea36872-d7a5-43ea-8da5-ecd028570ae5';

-- Dad's med
UPDATE medications SET
  name = 'Metformin',
  dosage_note = '500 mg · Twice daily with meals',
  kind = 'tablet',
  times_json = '["08:00","20:00"]'
WHERE id = '43913829-c278-4f0d-b439-7ac755f28097';

-- Grandma's med
UPDATE medications SET
  name = 'Telmisartan',
  dosage_note = '40 mg · Once daily (blood pressure)',
  kind = 'tablet',
  times_json = '["09:00"]'
WHERE id = '066de26a-04f5-4765-a4a9-b73d473dcd19';

-- ── 3. Sprinkle realistic dose logs for the last 7 days ──────
-- Clear old logs for these meds so we start fresh
DELETE FROM dose_logs WHERE medication_id IN (
  '8a155e12-14ee-452a-b105-1b03782c38d6',
  '252e20e7-96f4-45f2-bc4c-07cba9ca47fc',
  '74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',
  '90b6fdcc-03c8-4582-9f3b-a6d560ec97bd',
  '85de1cd3-9bf5-4077-a924-eaa64f6c3bc4',
  '136f34cc-9e65-424f-89ab-178bf5fc7ac9',
  'dea36872-d7a5-43ea-8da5-ecd028570ae5',
  '43913829-c278-4f0d-b439-7ac755f28097',
  '066de26a-04f5-4765-a4a9-b73d473dcd19'
);

-- Helper: insert logs for Cetirizine (21:00, daily)
INSERT OR IGNORE INTO dose_logs VALUES
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now','-6 days'),'21:00','taken', datetime('now','-6 days')),
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now','-5 days'),'21:00','taken', datetime('now','-5 days')),
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now','-4 days'),'21:00','skipped',datetime('now','-4 days')),
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now','-3 days'),'21:00','taken', datetime('now','-3 days')),
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now','-2 days'),'21:00','taken', datetime('now','-2 days')),
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now','-1 days'),'21:00','missed',datetime('now','-1 days')),
  (lower(hex(randomblob(16))),'252e20e7-96f4-45f2-bc4c-07cba9ca47fc',date('now'),'21:00','taken', datetime('now'));

-- Omega-3 (08:00 + 13:00)
INSERT OR IGNORE INTO dose_logs VALUES
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-5 days'),'08:00','taken',datetime('now','-5 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-5 days'),'13:00','taken',datetime('now','-5 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-4 days'),'08:00','taken',datetime('now','-4 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-4 days'),'13:00','skipped',datetime('now','-4 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-3 days'),'08:00','taken',datetime('now','-3 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-3 days'),'13:00','taken',datetime('now','-3 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-2 days'),'08:00','taken',datetime('now','-2 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-2 days'),'13:00','taken',datetime('now','-2 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-1 days'),'08:00','taken',datetime('now','-1 days')),
  (lower(hex(randomblob(16))),'74a0aab2-9d6a-49bc-8442-6b9dcf8f1901',date('now','-1 days'),'13:00','taken',datetime('now','-1 days'));

-- Amlodipine / Mom (09:00 daily)
INSERT OR IGNORE INTO dose_logs VALUES
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now','-6 days'),'09:00','taken', datetime('now','-6 days')),
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now','-5 days'),'09:00','taken', datetime('now','-5 days')),
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now','-4 days'),'09:00','taken', datetime('now','-4 days')),
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now','-3 days'),'09:00','missed',datetime('now','-3 days')),
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now','-2 days'),'09:00','taken', datetime('now','-2 days')),
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now','-1 days'),'09:00','taken', datetime('now','-1 days')),
  (lower(hex(randomblob(16))),'dea36872-d7a5-43ea-8da5-ecd028570ae5',date('now'),'09:00','taken', datetime('now'));

-- Metformin / Dad (08:00 + 20:00)
INSERT OR IGNORE INTO dose_logs VALUES
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-5 days'),'08:00','taken',datetime('now','-5 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-5 days'),'20:00','taken',datetime('now','-5 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-4 days'),'08:00','taken',datetime('now','-4 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-4 days'),'20:00','missed',datetime('now','-4 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-3 days'),'08:00','taken',datetime('now','-3 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-3 days'),'20:00','taken',datetime('now','-3 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-2 days'),'08:00','skipped',datetime('now','-2 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-2 days'),'20:00','taken',datetime('now','-2 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-1 days'),'08:00','taken',datetime('now','-1 days')),
  (lower(hex(randomblob(16))),'43913829-c278-4f0d-b439-7ac755f28097',date('now','-1 days'),'20:00','taken',datetime('now','-1 days'));

SELECT 'Done ✓ — demo data applied.' AS result;
