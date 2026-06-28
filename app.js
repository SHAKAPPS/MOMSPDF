/* ============================================================
   מחולל מסמכי PDF עם לוגו
   יצירת ה‑PDF ישירות בקוד (pdf-lib + bidi) — קובץ אמיתי:
   - עברית ומספרים נכונים תמיד (סידור דו‑כיווני + מיקום מוחלט של כל תו)
   - חלוקה לעמודים אוטומטית
   - הורדה / שיתוף ישיר (בלי חלון הדפסה, בלי כתובת אתר)
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

const LOGO_DATA = window.LOGO_DATA || {};
const LOGOS = {
  boaz: LOGO_DATA.boaz || "logos/boaz.png",
  gardenit: LOGO_DATA.gardenit || "logos/gardenit.png",
};

const bidi = window.bidi_js ? window.bidi_js() : null;

// טעינת הגופן המוטמע לתצוגה המקדימה כדי שתתאים בדיוק ל‑PDF
(function injectPreviewFont() {
  if (!window.FONT_DATA) return;
  const s = document.createElement("style");
  s.textContent =
    "@font-face{font-family:'AlefEmbed';src:url(data:font/ttf;base64," + window.FONT_DATA.regular + ") format('truetype');font-weight:400;font-style:normal;}" +
    "@font-face{font-family:'AlefEmbed';src:url(data:font/ttf;base64," + window.FONT_DATA.bold + ") format('truetype');font-weight:700;font-style:normal;}" +
    ".page,.page .page-body,.page .page-title,.page .page-date{font-family:'AlefEmbed','Segoe UI',Arial,sans-serif;}";
  document.head.appendChild(s);
})();

/* ===================== תצוגה מקדימה ===================== */
function updatePreview() {
  const selected = document.querySelector('input[name="logo"]:checked');
  const key = selected ? selected.value : "boaz";
  if (pageLogo.getAttribute("src") !== LOGOS[key]) pageLogo.src = LOGOS[key];

  if (showDateInput.checked) {
    pageDate.textContent = "תאריך: " + new Date().toLocaleDateString("he-IL");
    pageDate.style.display = "";
  } else {
    pageDate.textContent = "";
    pageDate.style.display = "none";
  }

  const title = docTitleInput.value.trim();
  pageTitle.textContent = title;
  pageTitle.hidden = !title;

  const body = bodyTextInput.value;
  pageBody.textContent = body;
  pageBody.classList.toggle("is-empty", body.trim() === "");

  layout();
}

function layout() {
  const prev = page.style.transform;
  page.style.transform = "none";
  const naturalW = page.offsetWidth;
  const naturalH = page.offsetHeight;
  page.style.transform = prev;
  const scale = Math.min(1, previewPane.clientWidth / naturalW);
  page.style.transform = "scale(" + scale + ")";
  page.style.transformOrigin = "top right";
  pageHolder.style.width = naturalW * scale + "px";
  pageHolder.style.height = naturalH * scale + "px";
}

/* ===================== עזרי PDF ===================== */
function b64ToBytes(b64) {
  const clean = b64.indexOf(",") >= 0 ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// סידור שורה לוגית לסדר ויזואלי נכון (דו‑כיווני)
function reorderLine(text) {
  if (!text || !bidi) return text || "";
  const lv = bidi.getEmbeddingLevels(text, "rtl");
  const segs = bidi.getReorderSegments(text, lv);
  const chars = text.split("");
  for (const seg of segs) {
    const s = seg[0], e = seg[1];
    const sub = chars.slice(s, e + 1).reverse();
    for (let i = 0; i < sub.length; i++) chars[s + i] = sub[i];
  }
  const mir = bidi.getMirroredCharactersMap(text, lv);
  if (mir && typeof mir.forEach === "function") mir.forEach((ch, idx) => { chars[idx] = ch; });
  return chars.join("");
}

const MM = 2.83465;
const PAGE_W = 595.28, PAGE_H = 841.89;
const margin = 16 * MM;

async function buildPdfBytes() {
  const PDFLib = window.PDFLib;
  const rgb = PDFLib.rgb;
  const pdf = await PDFLib.PDFDocument.create();
  pdf.registerFontkit(window.fontkit);

  const reg = await pdf.embedFont(b64ToBytes(window.FONT_DATA.regular), { subset: true });
  const bold = await pdf.embedFont(b64ToBytes(window.FONT_DATA.bold), { subset: true });

  const selected = document.querySelector('input[name="logo"]:checked');
  const key = selected ? selected.value : "boaz";
  const logo = await pdf.embedPng(b64ToBytes(LOGOS[key]));

  const green = rgb(74 / 255, 138 / 255, 61 / 255);
  const greenDark = rgb(53 / 255, 106 / 255, 43 / 255);
  const bodyColor = rgb(0.2, 0.2, 0.2);
  const gray = rgb(0.35, 0.35, 0.35);
  const rightX = PAGE_W - margin, leftX = margin, contentW = PAGE_W - 2 * margin;

  let pg = pdf.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - 18 * MM;

  function safeWidth(font, ch, size) {
    try { return font.widthOfTextAtSize(ch, size); } catch (e) { return font.widthOfTextAtSize(" ", size); }
  }
  function drawGlyph(font, ch, x, y, size, color) {
    try { pg.drawText(ch, { x, y, size, font, color }); } catch (e) { /* תו לא נתמך — מדלגים */ }
  }
  function drawVisual(logical, font, size, color, align) {
    const visual = reorderLine(logical);
    let total = 0;
    for (const ch of visual) total += safeWidth(font, ch, size);
    let x = align === "right" ? rightX - total : align === "center" ? (PAGE_W - total) / 2 : leftX;
    const baseY = cursorY - size;
    for (const ch of visual) {
      drawGlyph(font, ch, x, baseY, size, color);
      x += safeWidth(font, ch, size);
    }
  }
  function wrapLogical(text, font, size, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth || !cur) cur = test;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // לוגו ממורכז
  const logoW = 62 * MM, logoH = logoW * (logo.height / logo.width);
  pg.drawImage(logo, { x: (PAGE_W - logoW) / 2, y: cursorY - logoH, width: logoW, height: logoH });
  cursorY -= logoH + 7 * MM;

  // תאריך משמאל
  if (showDateInput.checked) {
    drawVisual("תאריך: " + new Date().toLocaleDateString("he-IL"), reg, 10, gray, "left");
    cursorY -= 4 * MM;
  }

  // קו מפריד
  pg.drawLine({ start: { x: leftX, y: cursorY }, end: { x: rightX, y: cursorY }, thickness: 1.6, color: green });
  cursorY -= 9 * MM;

  // כותרת
  const title = docTitleInput.value.trim();
  if (title) {
    for (const ln of wrapLogical(title, bold, 18, contentW)) { drawVisual(ln, bold, 18, greenDark, "center"); cursorY -= 9 * MM; }
    cursorY -= 3 * MM;
  }

  // גוף
  const bodySize = 12, lineH = 6.4 * MM;
  const body = bodyTextInput.value || "";
  for (const para of body.split("\n")) {
    if (para === "") { cursorY -= lineH; continue; }
    for (const ln of wrapLogical(para, reg, bodySize, contentW)) {
      if (cursorY < margin + lineH) { pg = pdf.addPage([PAGE_W, PAGE_H]); cursorY = PAGE_H - margin; }
      drawVisual(ln, reg, bodySize, bodyColor, "right");
      cursorY -= lineH;
    }
  }

  return await pdf.save();
}
window.__buildPdfBytes = buildPdfBytes; // לבדיקות אוטומטיות

function pdfFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const title = (docTitleInput.value.trim() || "מסמך").replace(/[\\/:*?"<>|]/g, "").slice(0, 40).trim() || "מסמך";
  return title + "-" + stamp + ".pdf";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function deliver(blob, filename) {
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }
  try { downloadBlob(blob, filename); return; } catch (e) { /* fallthrough */ }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

async function handleDownload() {
  const txtEl = downloadBtn.querySelector(".dl-text");
  const original = txtEl.textContent;
  downloadBtn.disabled = true;
  txtEl.textContent = "מכינה PDF...";
  try {
    const bytes = await buildPdfBytes();
    const blob = new Blob([bytes], { type: "application/pdf" });
    await deliver(blob, pdfFilename());
  } catch (err) {
    console.error("PDF build failed:", err);
    alert("אירעה תקלה ביצירת ה‑PDF.\n(" + (err && err.message ? err.message : String(err)) + ")\nנסי שוב, ואם זה חוזר — רעננו את הדף.");
  } finally {
    downloadBtn.disabled = false;
    txtEl.textContent = original;
  }
}

/* ===================== אירועים ===================== */
logoPicker.addEventListener("change", updatePreview);
docTitleInput.addEventListener("input", updatePreview);
bodyTextInput.addEventListener("input", updatePreview);
showDateInput.addEventListener("change", updatePreview);
downloadBtn.addEventListener("click", handleDownload);
window.addEventListener("resize", layout);
window.addEventListener("load", updatePreview);

updatePreview();
