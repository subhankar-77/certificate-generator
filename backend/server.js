/* ================================================================
   server.js — CIEM Felicitation Backend
   Framework : Express.js (Node.js)
   Database  : SQLite via better-sqlite3
               (connects to your existing SQLiteStudio .db file)
   ================================================================

   ── WHAT TO EDIT ──
   DB_PATH   → Full path to your .db file created in SQLiteStudio
   PORT      → Change if 3000 is already used on your machine
   All other settings are in the .env file.

   ── API ROUTES ──
   POST /api/verify-student   → looks up roll number, returns name
   POST /api/check-download   → checks if download_count <= 5
   POST /api/record-download  → increments download_count atomically
   GET  /health               → confirms server + DB are alive
   ================================================================ */

const express   = require("express");
const Database  = require("better-sqlite3");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 3000;


/* ── CONNECT TO SQLITE DATABASE ──
   EDIT: Set DB_PATH in your .env file to point to your .db file.
   Example .env line:
     DB_PATH=C:/Users/YourName/Documents/ciem_students.db

   better-sqlite3 opens the file directly — no server needed,
   no host/port/password — just the file path.
   The { readonly: false } flag is needed so we can UPDATE download_count.
*/
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "ciem_students.db");

let db;
try {
  db = new Database(DB_PATH, { readonly: false, fileMustExist: true });
  db.pragma("journal_mode = WAL");   // WAL mode: better concurrent read/write
  db.pragma("foreign_keys = ON");
  console.log(`✅ Connected to SQLite database: ${DB_PATH}`);
} catch (err) {
  console.error("❌ Could not open SQLite database:", err.message);
  console.error("   Check that DB_PATH in .env points to your actual .db file.");
  process.exit(1);   // Cannot run without a database
}


/* ── MIDDLEWARE ── */
app.use(helmet());
app.use(express.json());

// CORS — allows the frontend HTML to call this backend
// In production replace "*" with your deployed domain
app.use(cors({
  origin  : process.env.FRONTEND_ORIGIN || "*",
  methods : ["GET", "POST"],
}));

// Rate limiting — max 30 requests per IP per 15 minutes
// Protects against someone writing a script to brute-force roll numbers
const limiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 30,
  message  : { success: false, message: "Too many requests. Please wait and try again." },
});
app.use("/api/", limiter);


/* ================================================================
   ROUTE 1: POST /api/verify-student
   ================================================================
   What it does:
     Looks up the roll number in your SQLite `students` table.
     If found, returns the student's name and cert_id.
     Does NOT check a name — the name is fetched FROM the database.

   Request  body : { roll_number: "CSE2026001" }
   Response (ok) : { success: true, student: { name, cert_id } }
   Response (fail): { success: false, message: "..." }

   ── SQLite columns used ──
   Table    : students
   Columns  : roll_number, full_name, cert_id
              (download_count is NOT touched here — only on download)

   ── EDIT: column names ──
   If your SQLiteStudio table uses different column names, update
   the SQL string below (roll_number, full_name, cert_id).
================================================================ */
app.post("/api/verify-student", (req, res) => {
  const { roll_number } = req.body;

  if (!roll_number || typeof roll_number !== "string") {
    return res.status(400).json({ success: false, message: "Roll number is required." });
  }

  const rollUpper = roll_number.trim().toUpperCase();

  try {
    // better-sqlite3 uses synchronous queries — no async/await needed
    // UPPER() makes the lookup case-insensitive regardless of how
    // the roll number was stored in SQLiteStudio
    const student = db.prepare(`
      SELECT roll_number, full_name, cert_id, download_count
      FROM   students
      WHERE  UPPER(roll_number) = ?
      LIMIT  1
    `).get(rollUpper);

    if (!student) {
      return res.status(404).json({
        success : false,
        message : "Roll number not found in our records. Please check and try again.",
      });
    }

    return res.json({
      success : true,
      student : {
        name    : student.full_name,
        cert_id : student.cert_id || `CIEM-CSE-2026-${student.roll_number}`,
      },
    });

  } catch (err) {
    console.error("verify-student DB error:", err);
    return res.status(500).json({ success: false, message: "Server error. Please contact your coordinator." });
  }
});


/* ================================================================
   ROUTE 2: POST /api/check-download
   ================================================================
   Change 9 (Abuse Prevention):
     Before generating the PDF, the frontend asks the server whether
     this roll number is still allowed to download.
     If download_count > 5, the server returns allowed: false.
     This stops bots or pranksters from spamming your server and
     generating hundreds of PDFs, which could crash Node.js
     because Puppeteer/html2canvas uses a lot of RAM per render.

   Request  body : { roll_number: "CSE2026001" }
   Response (ok) : { allowed: true }
   Response (blocked): { allowed: false, message: "..." }
================================================================ */
app.post("/api/check-download", (req, res) => {
  const { roll_number } = req.body;

  if (!roll_number) {
    return res.status(400).json({ allowed: false, message: "Roll number missing." });
  }

  const rollUpper = roll_number.trim().toUpperCase();

  try {
    const student = db.prepare(`
      SELECT download_count
      FROM   students
      WHERE  UPPER(roll_number) = ?
      LIMIT  1
    `).get(rollUpper);

    if (!student) {
      return res.status(404).json({ allowed: false, message: "Roll number not found." });
    }

    const currentDownloads = student.download_count || 0;

    // Change 9: Block if already downloaded more than 5 times
    if (currentDownloads > 5) {
      return res.status(429).json({
        allowed : false,
        message : `Download limit reached (${currentDownloads}/5). Please contact your class coordinator.`,
      });
    }

    return res.json({ allowed: true, downloads_so_far: currentDownloads });

  } catch (err) {
    console.error("check-download DB error:", err);
    return res.status(500).json({ allowed: false, message: "Server error." });
  }
});


/* ================================================================
   ROUTE 3: POST /api/record-download
   ================================================================
   Change 7 (Atomic Update):
     Uses  SET download_count = download_count + 1  directly in SQL.
     This is an atomic operation — the database engine increments
     the value in a single locked step, so two students hitting the
     button at the exact same millisecond cannot both read the old
     value and both write the same incremented number.

   Change 8 note (RETURNING clause):
     RETURNING is a PostgreSQL feature. SQLite does support a limited
     form of it in newer versions, but to stay compatible with all
     versions of SQLite we do a separate SELECT after the UPDATE.
     This is safe because better-sqlite3 runs synchronously.

   Request  body : { roll_number: "CSE2026001" }
   Response (ok) : { success: true, download_count: N }
================================================================ */
app.post("/api/record-download", (req, res) => {
  const { roll_number } = req.body;

  if (!roll_number) {
    return res.status(400).json({ success: false, message: "Roll number missing." });
  }

  const rollUpper = roll_number.trim().toUpperCase();

  try {
    // Change 7: Atomic increment — one SQL statement, no race condition
    const result = db.prepare(`
      UPDATE students
      SET    download_count = download_count + 1
      WHERE  UPPER(roll_number) = ?
    `).run(rollUpper);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: "Roll number not found." });
    }

    // Change 8: Instead of RETURNING (PostgreSQL-only), we do a
    // second synchronous SELECT to get the updated count.
    // This is safe because better-sqlite3 is synchronous and
    // single-threaded — no other query can run between these two.
    const updated = db.prepare(`
      SELECT download_count
      FROM   students
      WHERE  UPPER(roll_number) = ?
    `).get(rollUpper);

    console.log(`📥 Download recorded — ${rollUpper} — total: ${updated.download_count}`);

    return res.json({ success: true, download_count: updated.download_count });

  } catch (err) {
    console.error("record-download DB error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});


/* ── HEALTH CHECK ── */
app.get("/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", db: "connected", db_path: DB_PATH });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});


/* ── OPTIONAL: Serve frontend from same server ──
   Uncomment the two lines below if you want to open the site
   via http://localhost:3000 instead of opening index.html directly.
*/
// app.use(express.static(path.join(__dirname, "../frontend")));


/* ── START SERVER ── */
app.listen(PORT, () => {
  console.log(`\n🎓  CIEM Felicitation Backend is running`);
  console.log(`    → http://localhost:${PORT}`);
  console.log(`    → Health: http://localhost:${PORT}/health`);
  console.log(`    → DB    : ${DB_PATH}\n`);
});

module.exports = app;
