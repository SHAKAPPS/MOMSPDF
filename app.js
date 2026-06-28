/* ============================================================
   מחולל מסמכי PDF עם לוגו
   יצירת ה‑PDF נעשית דרך מנגנון ההדפסה של הדפדפן (Save as PDF):
   - עברית ומספרים נכונים תמיד (רינדור מקורי, בלי שיבושים)
   - חלוקה לעמודים אוטומטית ונקייה
   - אף פעם לא יוצא ריק
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

// מקור הלוגו: data‑URI מוטמע אם קיים, אחרת קובץ רגיל
const LOGO_DATA = window.LOGO_DATA || {};
const LOGOS = {
  boaz: LOGO_DATA.boaz || "logos/boaz.png",
  gardenit: LOGO_DATA.gardenit || "logos/gardenit.png",
};

// --- עדכון התצוגה המקדימה (וכך גם ה‑PDF) ---
function updatePreview() {
  const selected = document.querySelector('input[name="logo"]:checked');
  const key = selected ? selected.value : "boaz";
  if (pageLogo.getAttribute("src") !== LOGOS[key]) {
    pageLogo.src = LOGOS[key];
  }

  if (showDateInput.checked) {
    const d = new Date();
    pageDate.textContent = "תאריך: " + d.toLocaleDateString("he-IL");
    pageDate.style.display = "";
  } else {
    pageDate.textContent = "";
    pageDate.style.display = "none";
  }

  const title = docTitleInput.value.trim();
  if (title) {
    pageTitle.textContent = title;
    pageTitle.hidden = false;
  } else {
    pageTitle.textContent = "";
    pageTitle.hidden = true;
  }

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

// --- שם ברירת המחדל לקובץ ה‑PDF (נלקח מכותרת הדף בזמן ההדפסה) ---
function pdfTitle() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const title = docTitleInput.value.trim() || "מסמך";
  return title + " " + stamp;
}

// --- הפעולה הראשית: פתיחת חלון "שמירה / הדפסה כ‑PDF" ---
function handlePrint() {
  updatePreview();
  const prevTitle = document.title;
  document.title = pdfTitle(); // משפיע על שם הקובץ שמוצע לשמירה
  // השהיה קצרה כדי לתת לדפדפן לעדכן את התצוגה לפני ההדפסה
  setTimeout(function () {
    window.print();
    setTimeout(function () {
      document.title = prevTitle;
    }, 800);
  }, 60);
}

// --- חיבור אירועים ---
logoPicker.addEventListener("change", updatePreview);
docTitleInput.addEventListener("input", updatePreview);
bodyTextInput.addEventListener("input", updatePreview);
showDateInput.addEventListener("change", updatePreview);
downloadBtn.addEventListener("click", handlePrint);
window.addEventListener("resize", layout);
window.addEventListener("load", updatePreview);

// הרצה ראשונית
updatePreview();
