/* ================================================================
   script.js — CIEM Felicitation Ceremony 2026
   ================================================================

   ── WHAT YOU NEED TO EDIT ──

   1. API_BASE_URL   → Port must match what you set in server.js
   2. CEREMONY_DATE  → Your actual felicitation date
   3. AUTHORITIES    → Real names of Principal and HOD
   4. getCertText()  → The paragraph text printed on the certificate

   Everything else is application logic — no need to touch it.
   ================================================================ */


/* ══════════════════════════════════════════════════════════════
   CONFIGURATION — EDIT THESE VALUES
   ══════════════════════════════════════════════════════════════ */

// Backend server URL. Change 3000 if you set a different PORT in .env
const API_BASE_URL = "http://localhost:3000";

// EDIT: The date printed on every certificate
const CEREMONY_DATE = "5th June, 2026";

// EDIT: Authority names — these appear in the signature section
const AUTHORITIES = {
  principal : "Dr. Rakhi Bhattacharya",   // ← replace with real Principal name
  hod       : "Prof. Rupayan Sanyal",   // ← replace with real HOD name
};

// EDIT: The paragraph text printed on the certificate body.
// `name` is already the verified name fetched from the database.
function getCertText(name) {
  return `This is to certify that <strong>${name}</strong> has successfully completed
the four-year Bachelor of Technology degree in
<strong>Computer Science &amp; Engineering</strong>
from <strong>Calcutta Institute of Engineering &amp; Management</strong>,
affiliated to Maulana Abul Kalam Azad University of Technology (MAKAUT), West Bengal,
in the graduating year <strong>2026</strong>, and is hereby felicitated on
<strong>${CEREMONY_DATE}</strong> in recognition of this distinguished academic achievement.`;
}


/* ══════════════════════════════════════════════════════════════
   APPLICATION LOGIC — No need to edit below
   ══════════════════════════════════════════════════════════════ */

// Keeps track of the current verified roll number for the download step
let currentRoll = null;


/* ── STEP 1: Verify roll number against SQLite database ── */
async function generateCertificate() {
  const roll    = document.getElementById("rollInput").value.trim().toUpperCase();
  const errEl   = document.getElementById("formError");
  const loader  = document.getElementById("formLoader");

  // Change 6: Disable generate button while request is in flight
  // so a student cannot click multiple times and create duplicate records.
  const generateBtn = document.getElementById("generateBtn");

  if (!roll) {
    showError(errEl, "Please enter your roll number.");
    return;
  }

  errEl.textContent = "";
  loader.classList.add("show");
  generateBtn.disabled = true;         // ← Change 6

  try {
    const res  = await fetch(`${API_BASE_URL}/api/verify-student`, {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify({ roll_number: roll }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      currentRoll = roll;
      populateCertificate(data.student.name, roll, data.student.cert_id);
      document.getElementById("certWrapper").classList.remove("hidden");
      document.getElementById("certWrapper").scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showError(errEl, data.message || "Roll number not found in our records.");
    }

  } catch (err) {
    showError(errEl, "Cannot reach the server. Make sure the backend is running on port 3000.");
    console.error("verify-student error:", err);
  } finally {
    loader.classList.remove("show");
    generateBtn.disabled = false;      // re-enable after response
  }
}


/* ── Populate the certificate DOM with verified data ── */
function populateCertificate(name, roll, certId) {
  document.getElementById("certName").textContent     = name;
  document.getElementById("certDesc").innerHTML       = getCertText(name);
  document.getElementById("certPrincipal").textContent = AUTHORITIES.principal;
  document.getElementById("certHod").textContent       = AUTHORITIES.hod;

  // Use cert_id from DB if present, otherwise build one from roll number
  const displayId = certId ? certId : ("CIEM-CSE-2026-" + roll);
  document.getElementById("certIdStamp").textContent  = "Cert ID: " + displayId;
}


/* ── STEP 2: Generate PDF and trigger download ──
   Flow:
   1. html2canvas captures #certificate as a high-res canvas
   2. jsPDF converts that canvas to a proper A4-landscape PDF
   3. Backend is notified to increment download_count atomically
      (Change 7: atomic SQL update to prevent race conditions)
   4. Change 8 note: SQLite does not support RETURNING — so we do
      a separate SELECT after the UPDATE (handled server-side)
   5. Change 9: backend blocks if download_count > 5 for this roll
*/
async function downloadCertificate() {
  const downloadBtn   = document.getElementById("downloadBtn");
  const studentName   = document.getElementById("certName").textContent.replace(/\s+/g, "_");
  const cert          = document.getElementById("certificate");

  // Change 6: Disable download button while PDF is generating
  // Prevents students from clicking multiple times which would:
  // - spike the download_count in SQLiteStudio
  // - potentially crash Node.js by spawning multiple heavy renders
  downloadBtn.disabled    = true;
  downloadBtn.textContent = "⏳ Generating PDF…";

  try {
    // First: check with server whether download is still permitted
    // Change 9: Server will return 429 if download_count > 5
    const checkRes = await fetch(`${API_BASE_URL}/api/check-download`, {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify({ roll_number: currentRoll }),
    });

    const checkData = await checkRes.json();

    if (!checkRes.ok || !checkData.allowed) {
      alert(checkData.message || "Download limit reached. Please contact your coordinator.");
      return;
    }

    // Capture the certificate div at 3× resolution for sharp PDF output
    const canvas = await html2canvas(cert, {
      scale           : 3,
      useCORS         : true,
      backgroundColor : "#fdf8ef",
      logging         : false,
    });

    // Convert canvas to PDF (A4 landscape: 297mm × 210mm)
    const { jsPDF } = window.jspdf;
    const pdf       = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pageW  = pdf.internal.pageSize.getWidth();   // 297
    const pageH  = pdf.internal.pageSize.getHeight();  // 210
    const imgData = canvas.toDataURL("image/png");

    // Fit the certificate image to the full A4 page
    pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
    pdf.save(`CIEM_CSE_Felicitation_2026_${studentName}.pdf`);

    // Notify backend to increment download_count atomically
    // Change 7: Backend uses  SET download_count = download_count + 1
    // so two simultaneous clicks cannot both read 0 and both write 1
    await fetch(`${API_BASE_URL}/api/record-download`, {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify({ roll_number: currentRoll }),
    });

  } catch (err) {
    alert("PDF generation failed. Please try again or contact your coordinator.");
    console.error("downloadCertificate error:", err);
  } finally {
    downloadBtn.disabled    = false;
    downloadBtn.textContent = "⬇ Download as PDF";
  }
}


/* ── Reset form to generate another certificate ── */
function resetForm() {
  currentRoll = null;
  document.getElementById("rollInput").value    = "";
  document.getElementById("formError").textContent = "";
  document.getElementById("certWrapper").classList.add("hidden");
  document.getElementById("certName").textContent  = "";
  document.getElementById("certDesc").innerHTML    = "";
  document.getElementById("certIdStamp").textContent = "";
  document.getElementById("formSection").scrollIntoView({ behavior: "smooth", block: "start" });
}


/* ── Helper: display error text ── */
function showError(el, msg) {
  el.textContent = msg;
}


/* ── Keyboard: Enter on roll input triggers generation ── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("rollInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateCertificate();
  });
});
