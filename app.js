/* ============================================================
   מחולל מסמכי PDF עם לוגו — לוגיקה
   ============================================================ */

// --- אלמנטים ---
const logoPicker = document.getElementById("logoPicker");
const docTitleInput = document.getElementById("docTitle");
const bodyTextInput = document.getElementById("bodyText");
const showDateInput = document.getElementById("showDate");
const downloadBtn = document.getElementById("downloadBtn");

const page = document.getElementById("page");
const pageHolder = document.getElementById("pageHolder");
const pageLogo = document.getElementById("pageLogo");
const pageDate = document.getElementById("pageDate");
const pageTitle = document.getElementById("pageTitle");
const pageBody = document.getElementById("pageBody");
const previewPane = document.querySelector(".preview-pane");

// מקור הלוגו לתצוגה ול‑PDF: data‑URI מוטמע אם קיים (מונע "tainted canvas"),
// אחרת קובץ רגיל כגיבוי.
const LOGO_DATA = window.LOGO_DATA || {};
const LOGOS = {
  boaz: LOGO_DATA.boaz || "logos/boaz.png",
  gardenit: LOGO_DATA.gardenit || "logos/gardenit.png",
};

// --- עדכון התצוגה המקדימה (וכך גם ה‑PDF) ---
function updatePreview() {
  // לוגו
  const selected = document.querySelector('input[name="logo"]:checked');
  const key = selected ? selected.value : "boaz";
  if (pageLogo.getAttribute("src") !== LOGOS[key]) {
    pageLogo.src = LOGOS[key];
  }

  // תאריך
  if (showDateInput.checked) {
    const d = new Date();
    pageDate.textContent = "תאריך: " + d.toLocaleDateString("he-IL");
    pageDate.style.display = "";
  } else {
    pageDate.textContent = "";
    pageDate.style.display = "none";
  }

  // כותרת
  const title = docTitleInput.value.trim();
  if (title) {
    pageTitle.textContent = title;
    pageTitle.hidden = false;
  } else {
    pageTitle.textContent = "";
    pageTitle.hidden = true;
  }

  // גוף הטקסט
  const body = bodyTextInput.value;
  pageBody.textContent = body;
  pageBody.classList.toggle("is-empty", body.trim() === "");

  layout();
}

// --- התאמת גודל התצוגה המקדימה למסך (לא משפיע על ה‑PDF) ---
function layout() {
  const prev = page.style.transform;
  page.style.transform = "none";
  const naturalW = page.offsetWidth;
  const naturalH = page.offsetHeight;
  page.style.transform = prev;

  const available = previewPane.clientWidth;
  const scale = Math.min(1, available / naturalW);

  page.style.transform = "scale(" + scale + ")";
  page.style.transformOrigin = "top right";
  pageHolder.style.width = naturalW * scale + "px";
  pageHolder.style.height = naturalH * scale + "px";
}

// --- וידוא שתמונה נטענה לפני יצירת ה‑PDF ---
function imageReady(img) {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) return resolve();
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

// --- שם הקובץ ---
function buildFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const title = docTitleInput.value.trim() || "מסמך";
  const base = title.replace(/[\\/:*?"<>|]/g, "").slice(0, 40).trim() || "מסמך";
  return base + "-" + stamp + ".pdf";
}

// --- בניית עותק נקי לצילום ---
// חשוב: מצלמים אלמנט שנמצא *על המסך* (לא מחוץ לו), כי כשמצלמים אלמנט מוסתר
// מחוץ למסך חלק מהדפדפנים מפיקים עמוד ריק. מכסים את המסך בלבן זמנית.
async function generatePdfBlob() {
  const clone = page.cloneNode(true);
  clone.style.position = "static"; // בתצוגה ה‑.page הוא absolute — מחזירים לזרימה רגילה
  clone.style.top = "auto";
  clone.style.right = "auto";
  clone.style.transform = "none";
  clone.style.minHeight = "0";
  clone.style.boxShadow = "none";
  clone.style.margin = "0";
  const cloneBody = clone.querySelector(".page-body");
  if (cloneBody) cloneBody.classList.remove("is-empty");

  // עוטף את העותק בפינה השמאלית‑עליונה (על המסך) — צילום אמין
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.left = "0";
  wrap.style.top = "0";
  wrap.style.width = "210mm";
  wrap.style.background = "#ffffff";
  wrap.style.zIndex = "2147483646";
  wrap.appendChild(clone);

  // כיסוי לבן מעל הכול כדי שלא יראו הבזק בזמן הצילום
  const cover = document.createElement("div");
  cover.style.position = "fixed";
  cover.style.inset = "0";
  cover.style.background = "#ffffff";
  cover.style.zIndex = "2147483647";

  document.body.appendChild(wrap);
  document.body.appendChild(cover);

  try {
    const opt = {
      margin: 0,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    return await html2pdf().set(opt).from(clone).outputPdf("blob");
  } finally {
    wrap.remove();
    cover.remove();
  }
}
// חשיפה לבדיקות אוטומטיות
window.__generatePdfBlob = generatePdfBlob;

// --- הורדה רגילה (מחשב / דפדפן ללא שיתוף קבצים) ---
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// --- הפעולה הראשית: בטלפון פותח תפריט שיתוף, במחשב מוריד קובץ ---
async function handleDownload() {
  const txtEl = downloadBtn.querySelector(".dl-text");
  const originalText = txtEl.textContent;
  downloadBtn.disabled = true;
  txtEl.textContent = "מכינה PDF...";

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await imageReady(pageLogo);

    const blob = await generatePdfBlob();
    const filename = buildFilename();
    const file = new File([blob], filename, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // טלפון: תפריט שיתוף (וואטסאפ / מייל / שמירה בקבצים)
      try {
        await navigator.share({ files: [file], title: filename });
      } catch (err) {
        if (err && err.name === "AbortError") {
          // המשתמשת ביטלה — לא עושים כלום
        } else {
          downloadBlob(blob, filename);
        }
      }
    } else {
      // מחשב: הורדה רגילה
      downloadBlob(blob, filename);
    }
  } catch (err) {
    console.error(err);
    alert("אירעה תקלה ביצירת ה‑PDF. נסי שוב, ואם זה חוזר — רעננו את הדף.");
  } finally {
    downloadBtn.disabled = false;
    txtEl.textContent = originalText;
  }
}

// --- חיבור אירועים ---
logoPicker.addEventListener("change", updatePreview);
docTitleInput.addEventListener("input", updatePreview);
bodyTextInput.addEventListener("input", updatePreview);
showDateInput.addEventListener("change", updatePreview);
downloadBtn.addEventListener("click", handleDownload);
window.addEventListener("resize", layout);
window.addEventListener("load", updatePreview);

// הרצה ראשונית
updatePreview();
