# 🎓 CIEM Felicitation Certificate Portal — 2026
### Calcutta Institute of Engineering & Management · CSE Department

---

## 📁 Project Structure

```
ciem-felicitation/
│
├── frontend/
│   ├── index.html          ← Webpage (structure only)
│   ├── style.css           ← All styling including certificate look
│   └── script.js           ← Logic, API calls, PDF generation
│
└── backend/
    ├── server.js           ← Express server + 3 API routes
    ├── package.json        ← Node.js dependencies
    ├── .env                ← Your secrets (DB path, port)
    └── database_setup.sql  ← Reference SQL for your SQLiteStudio table
```

---

## ✅ Prerequisites

| Tool | Download |
|------|----------|
| **Node.js** (v18+) | https://nodejs.org |
| **SQLiteStudio** | https://sqlitestudio.pl (you already have this) |

---

## ⚙️ Step 1 — Prepare Your SQLiteStudio Database

Your table must have these columns:

| Column | Type | Notes |
|--------|------|-------|
| `roll_number` | TEXT | Unique, used to look up students |
| `full_name` | TEXT | Printed on the certificate |
| `cert_id` | TEXT | Unique ID printed bottom-right of cert |
| `download_count` | INTEGER | Default 0 — tracks how many times downloaded |

**If you are missing `download_count`**, run this one line in SQLiteStudio's SQL Editor:
```sql
ALTER TABLE students ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;
```

---

## ⚙️ Step 2 — Configure the Backend

Open `backend/.env` and set:
```env
PORT=3000
DB_PATH=C:/Users/YourName/Documents/ciem_students.db   ← your actual .db file path
```

---

## 📦 Step 3 — Install Backend Dependencies

Open a terminal, go to the backend folder, run:
```bash
cd ciem-felicitation/backend
npm install
```

This installs: `express`, `better-sqlite3`, `cors`, `helmet`, `dotenv`, `express-rate-limit`

---

## 🚀 Step 4 — Start the Backend

```bash
npm start
```

You should see:
```
✅ Connected to SQLite database: C:/...your path.../ciem_students.db
🎓  CIEM Felicitation Backend is running
    → http://localhost:3000
    → Health: http://localhost:3000/health
```

Open http://localhost:3000/health to confirm. You should see:
```json
{"status":"ok","db":"connected"}
```

---

## 🌐 Step 5 — Open the Frontend

Double-click `frontend/index.html` to open it in your browser.
The roll number form appears immediately — no access code needed.

---

## ✏️ What to Edit & Where

| What | File | Search for |
|------|------|-----------|
| Ceremony date on certificate | `script.js` | `CEREMONY_DATE` |
| Principal name | `script.js` | `AUTHORITIES` |
| HOD name | `script.js` | `AUTHORITIES` |
| Certificate paragraph text | `script.js` | `getCertText()` |
| Backend port | `.env` | `PORT=` |
| SQLite file path | `.env` | `DB_PATH=` |
| Certificate colors/fonts/layout | `style.css` | `/* CERTIFICATE STYLES */` |
| College logo | `index.html` | `EDIT: Replace` comment |

---

## 🔐 Security Features Built In

| Feature | Detail |
|---------|--------|
| Roll number verification | Only roll numbers in your SQLite database will generate a certificate |
| Button disable on click | Generate and Download buttons are disabled while processing — prevents duplicate requests |
| Atomic download_count | `SET download_count = download_count + 1` in SQL — no race condition possible |
| Abuse prevention | download_count > 5 for any roll number → server returns 429 and blocks the request |
| Rate limiting | Max 30 API requests per IP per 15 minutes — stops brute-force scanning |

---

## 📊 Monitor Downloads During the Ceremony

Run this in SQLiteStudio's SQL Editor at any time:

```sql
-- Who has downloaded (most downloads first):
SELECT roll_number, full_name, download_count
FROM   students
WHERE  download_count > 0
ORDER  BY download_count DESC;

-- Who hasn't downloaded yet:
SELECT roll_number, full_name
FROM   students
WHERE  download_count = 0;

-- Total downloads so far:
SELECT SUM(download_count) AS total_downloads FROM students;
```

---

## ❓ Troubleshooting

**"Cannot reach server" in browser**
→ Make sure `npm start` is running in the backend/ folder
→ Check PORT in .env matches API_BASE_URL in script.js

**"Could not open SQLite database"**
→ Check DB_PATH in .env points to the exact .db file path
→ Make sure SQLiteStudio is not locking the file in exclusive mode

**Certificate PDF is blurry**
→ It's captured at 3× resolution — the PDF will be sharp when opened in a PDF viewer

**download_count not incrementing**
→ Open http://localhost:3000/health to confirm the DB is connected
→ Check your table has a `download_count` column (see Step 1)
