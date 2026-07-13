/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · CSV parser + čísla
   ═══════════════════════════════════════════════════════════ */
window.SP = window.SP || {};

/* Parsovanie CSV textu na pole riadkov (zvláda úvodzovky aj čiarky v hodnotách) */
SP.parseCSV = function (text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM
  const rows = [];
  let row = [], field = "", vUvodzovkach = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (vUvodzovkach) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else vUvodzovkach = false;
      } else field += c;
    } else {
      if (c === '"') vUvodzovkach = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
};

/* Prevod hodnoty z exportu na číslo: " --" → 0, "1,434.09" → 1434.09, "4.79%" → 4.79 */
SP.num = function (v) {
  if (v == null) return 0;
  v = String(v).trim();
  if (!v || v === "--" || v === "—") return 0;
  v = v.replace(/%$/, "").replace(/,/g, "");
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/* Bezpečné delenie */
SP.div = (a, b) => (b > 0 ? a / b : 0);
