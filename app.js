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

// --- בדיקה אם ה‑canvas יצא ריק (לבן) — קורה בחלק מהדפדפנים בטלפון ---
function isCanvasBlank(canvas) {
  try {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return true;
    const data = ctx.getImageData(0, 0, w, h).data;
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
        nonWhite++;
        if (nonWhite > 20) return false; // ברור שיש תוכן
      }
    }
    return nonWhite < 5;
  } catch (e) {
    return false; // אם אי אפשר לקרוא — לא מניחים שריק
  }
}

// --- בניית עותק נקי לצילום ---
// מצלמים אלמנט שנמצא *על המסך* (מכוסה בלבן), בודקים שהתוצאה לא ריקה,
// ורק אז יוצרים PDF. אם ה‑canvas ריק — זורקים שגיאה כדי לעבור להדפסה.
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

  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.left = "0";
  wrap.style.top = "0";
  wrap.style.width = "210mm";
  wrap.style.background = "#ffffff";
  wrap.style.zIndex = "2147483646";
  wrap.appendChild(clone);

  const cover = document.createElement("div");
  cover.style.position = "fixed";
  cover.style.inset = "0";
  cover.style.background = "#ffffff";
  cover.style.zIndex = "2147483647";

  document.body.appendChild(wrap);
  document.body.appendChild(cover);

  const prevScroll = window.scrollY;
  window.scrollTo(0, 0); // עוזר ל‑iOS Safari לצלם נכון

  try {
    const opt = {
      margin: 0,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    const worker = html2pdf().set(opt).from(clone);
    const canvas = await worker.toCanvas().get("canvas");
    if (isCanvasBlank(canvas)) {
      const err = new Error("BLANK_CANVAS");
      err.code = "BLANK";
      throw err;
    }
    return await worker.toImg().toPdf().outputPdf("blob");
  } finally {
    wrap.remove();
    cover.remove();
    window.scrollTo(0, prevScroll);
  }
}
// חשיפה לבדיקות אוטומטיות
window.__generatePdfBlob = generatePdfBlob;

// --- גיבוי: הדפסה דרך הדפדפן (אמין במיוחד בטלפון; אפשר "שמור כ‑PDF" / לשתף) ---
function printFallback() {
  window.print();
}
window.__printFallback = printFallback;

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

// --- מסירת הקובץ: שיתוף → הורדה → פתיחה בלשונית. אף פעם לא מציג שגיאה מפחידה ---
async function deliverPdf(blob, filename) {
  // 1) טלפון: תפריט שיתוף (וואטסאפ / מייל / שמירה בקבצים)
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // המשתמשת ביטלה את השיתוף
    // אחרת — ממשיכים להורדה
  }

  // 2) מחשב / דפדפן ללא שיתוף: הורדה רגילה
  try {
    downloadBlob(blob, filename);
    return;
  } catch (err) {
    /* ממשיכים לפתיחה בלשונית */
  }

  // 3) מוצא אחרון: פתיחת ה‑PDF בלשונית חדשה (שם אפשר לשמור/לשתף ידנית)
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// --- הפעולה הראשית ---
async function handleDownload() {
  const txtEl = downloadBtn.querySelector(".dl-text");
  const originalText = txtEl.textContent;
  downloadBtn.disabled = true;
  txtEl.textContent = "מכינה PDF...";

  let blob, filename;
  // שלב היצירה
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await imageReady(pageLogo);
    filename = buildFilename();
    blob = await generatePdfBlob();
  } catch (err) {
    console.error("PDF generation failed:", err);
    downloadBtn.disabled = false;
    txtEl.textContent = originalText;
    if (err && err.code === "BLANK") {
      // הדפדפן הפיק עמוד ריק — עוברים אוטומטית להדפסה (אמין בטלפון)
      printFallback();
    } else {
      alert(
        "אירעה תקלה ביצירת ה‑PDF.\n(" +
          (err && err.message ? err.message : String(err)) +
          ")\nאפשר לנסות את כפתור «הדפסה / שמירה» שמתחת לכפתור."
      );
    }
    return;
  }

  // שלב המסירה — חסין לתקלות, לא מציג שגיאה
  try {
    await deliverPdf(blob, filename);
  } catch (err) {
    console.error("delivery failed:", err);
    try {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      /* אין מה לעשות יותר */
    }
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
const printLink = document.getElementById("printLink");
if (printLink) {
  printLink.addEventListener("click", function (e) {
    e.preventDefault();
    printFallback();
  });
}
window.addEventListener("resize", layout);
window.addEventListener("load", updatePreview);

// הרצה ראשונית
updatePreview();
