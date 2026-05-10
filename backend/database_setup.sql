-- ================================================================
-- database_setup.sql — SQLite setup for CIEM Felicitation Portal
-- Run this in SQLiteStudio: Tools → Open SQL Editor → paste → Run
-- ================================================================
-- NOTE: Since you said you already have your table created and
-- data inserted in SQLiteStudio, this file is a REFERENCE only.
-- Only run the parts you haven't already done.
-- ================================================================


-- ── YOUR TABLE STRUCTURE ──
-- Your students table should have these columns.
-- (You said you removed created_at — that's fine, it's not used.)

CREATE TABLE IF NOT EXISTS students (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_number    TEXT    NOT NULL UNIQUE,
  full_name      TEXT    NOT NULL,
  cert_id        TEXT    UNIQUE,
  download_count INTEGER NOT NULL DEFAULT 0
  -- NOTE: created_at has been intentionally removed as per your setup
);

-- Index for fast roll number lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_roll ON students (roll_number COLLATE NOCASE);


-- ── ADD download_count IF YOUR TABLE DOESN'T HAVE IT YET ──
-- If your existing table is missing the download_count column,
-- run just this one line in SQLiteStudio:
--
--   ALTER TABLE students ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;


-- ── SAMPLE DATA ──
-- Only run this if your table is empty.
-- Replace these with your real student data.

INSERT OR IGNORE INTO students (roll_number, full_name, cert_id) VALUES
  ('CSE2026001', 'Aniket Sharma',       'CIEM-CSE-2026-001'),
  ('CSE2026002', 'Priya Banerjee',      'CIEM-CSE-2026-002'),
  ('CSE2026003', 'Rohit Mondal',        'CIEM-CSE-2026-003'),
  ('CSE2026004', 'Sneha Das',           'CIEM-CSE-2026-004'),
  ('CSE2026005', 'Arjun Ghosh',         'CIEM-CSE-2026-005'),
  ('CSE2026006', 'Tanisha Roy',         'CIEM-CSE-2026-006'),
  ('CSE2026007', 'Souvik Chatterjee',   'CIEM-CSE-2026-007'),
  ('CSE2026008', 'Rimpa Sen',           'CIEM-CSE-2026-008'),
  ('CSE2026009', 'Debraj Chakraborty',  'CIEM-CSE-2026-009'),
  ('CSE2026010', 'Nisha Pal',           'CIEM-CSE-2026-010');
  -- ↑ Add all your students here. INSERT OR IGNORE means
  --   re-running this file will not overwrite existing rows.


-- ================================================================
-- ADMIN / MONITORING QUERIES
-- Run these in SQLiteStudio during or after the ceremony
-- ================================================================

-- See who has downloaded their certificate (sorted by most downloads):
SELECT roll_number, full_name, download_count
FROM   students
WHERE  download_count > 0
ORDER  BY download_count DESC;

-- See who has NOT yet downloaded:
SELECT roll_number, full_name
FROM   students
WHERE  download_count = 0
ORDER  BY roll_number;

-- Count total downloads across all students:
SELECT SUM(download_count) AS total_downloads FROM students;

-- Check a specific student:
-- SELECT * FROM students WHERE roll_number = 'CSE2026001';

-- Reset a specific student's download count (if they had issues):
-- UPDATE students SET download_count = 0 WHERE roll_number = 'CSE2026001';

-- Reset ALL download counts (use only for testing):
-- UPDATE students SET download_count = 0;
