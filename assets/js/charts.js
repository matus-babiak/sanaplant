/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · formátovanie čísel + SVG grafy
   ═══════════════════════════════════════════════════════════ */
window.SP = window.SP || {};

/* ── formátovanie (sk-SK) ───────────────────────────────── */
(() => {
  const mena = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  const menaCele = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const cele = new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 });
  const des1 = new Intl.NumberFormat("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const des2 = new Intl.NumberFormat("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  SP.fmt = {
    mena: v => mena.format(v || 0),
    menaKratka: v => (Math.abs(v) >= 1000 ? menaCele.format(v || 0) : mena.format(v || 0)),
    cislo: v => cele.format(Math.round(v || 0)),
    des1: v => des1.format(v || 0),
    pct: v => des2.format(v || 0) + " %",
    pct1: v => des1.format(v || 0) + " %",
    roas: v => des2.format(v || 0) + "×",
    kompakt(v) {
      v = v || 0;
      if (Math.abs(v) >= 1_000_000) return des1.format(v / 1_000_000) + " M";
      if (Math.abs(v) >= 10_000) return cele.format(Math.round(v / 1000)) + " tis.";
      return cele.format(Math.round(v));
    }
  };
})();

/* ── tooltip ────────────────────────────────────────────── */
SP.tooltip = {
  el: null,
  ukaz(html, x, y) {
    if (!this.el) this.el = document.getElementById("tooltip");
    this.el.innerHTML = html;
    this.el.hidden = false;
    const r = this.el.getBoundingClientRect();
    let px = x + 14, py = y - r.height - 10;
    if (px + r.width > window.innerWidth - 8) px = x - r.width - 14;
    if (py < 8) py = y + 16;
    this.el.style.left = px + "px";
    this.el.style.top = py + "px";
  },
  skry() { if (this.el) this.el.hidden = true; }
};

/* ── stĺpcový graf trendu ───────────────────────────────────
   polozky: [{ label, tooltipLabel, hodnoty: [{ nazov, farba, value|null }] }]
   opts: { format, vyska } — value null = mesiac bez dát
*/
SP.stlpcovyGraf = function (el, polozky, opts = {}) {
  el.innerHTML = "";
  const fmt = opts.format || SP.fmt.cislo;
  const sirka = Math.max(el.clientWidth || 640, 320);
  const vyska = opts.vyska || 260;
  const okrajL = 46, okrajP = 8, okrajH = 12, okrajD = 26;
  const W = sirka - okrajL - okrajP, H = vyska - okrajH - okrajD;

  const vsetky = polozky.flatMap(p => p.hodnoty.map(h => h.value)).filter(v => v != null);
  if (!vsetky.length) {
    el.innerHTML = `<p class="graf-prazdny">Za zvolené obdobie nie sú žiadne dáta.</p>`;
    return;
  }
  let max = Math.max(...vsetky, 0);
  if (max <= 0) max = 1;

  // zaokrúhlenie osi na pekné číslo
  const krok = Math.pow(10, Math.floor(Math.log10(max)));
  const nasobky = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const strop = nasobky.map(n => n * krok).find(n => n >= max) || max;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${sirka} ${vyska}`);
  svg.setAttribute("width", sirka);
  svg.setAttribute("height", vyska);

  const ciara = getComputedStyle(document.documentElement).getPropertyValue("--ciara").trim();
  const textSlaby = getComputedStyle(document.documentElement).getPropertyValue("--text-slaby").trim();

  // mriežka + popisky osi Y
  for (let i = 0; i <= 4; i++) {
    const y = okrajH + H - (H * i) / 4;
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", okrajL); l.setAttribute("x2", sirka - okrajP);
    l.setAttribute("y1", y); l.setAttribute("y2", y);
    l.setAttribute("stroke", ciara); l.setAttribute("stroke-width", "1");
    svg.appendChild(l);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", okrajL - 6); t.setAttribute("y", y + 3);
    t.setAttribute("text-anchor", "end");
    t.setAttribute("font-size", "10"); t.setAttribute("fill", textSlaby);
    t.textContent = SP.fmt.kompakt((strop * i) / 4);
    svg.appendChild(t);
  }

  const n = polozky.length;
  const seria = Math.max(1, polozky[0]?.hodnoty.length || 1);
  const slot = W / n;
  const medzera = Math.min(slot * 0.25, 14);
  const sirkaStlpca = Math.max(3, (slot - medzera) / seria);

  polozky.forEach((p, pi) => {
    p.hodnoty.forEach((h, hi) => {
      const x = okrajL + pi * slot + medzera / 2 + hi * sirkaStlpca;
      if (h.value == null) {
        // mesiac bez dát – jemná bodka
        const dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", x + sirkaStlpca / 2);
        dot.setAttribute("cy", okrajH + H - 3);
        dot.setAttribute("r", "2");
        dot.setAttribute("fill", textSlaby);
        svg.appendChild(dot);
        return;
      }
      const hh = Math.max(2, (h.value / strop) * H);
      const r = document.createElementNS(ns, "rect");
      r.setAttribute("x", x);
      r.setAttribute("y", okrajH + H - hh);
      r.setAttribute("width", Math.max(2, sirkaStlpca - 2));
      r.setAttribute("height", hh);
      r.setAttribute("rx", Math.min(4, sirkaStlpca / 3));
      r.setAttribute("fill", h.farba);
      r.setAttribute("class", "stlpec");
      r.addEventListener("mousemove", ev => {
        SP.tooltip.ukaz(`<strong>${p.tooltipLabel || p.label}</strong>${h.nazov ? h.nazov + ": " : ""}${fmt(h.value)}`, ev.clientX, ev.clientY);
      });
      r.addEventListener("mouseleave", () => SP.tooltip.skry());
      svg.appendChild(r);
    });

    // popisok osi X (pri veľa mesiacoch len každý n-tý)
    const kazdy = n > 18 ? 3 : n > 9 ? 2 : 1;
    if (pi % kazdy === 0) {
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", okrajL + pi * slot + slot / 2);
      t.setAttribute("y", vyska - 8);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "10"); t.setAttribute("fill", textSlaby);
      t.textContent = p.label;
      svg.appendChild(t);
    }
  });

  el.appendChild(svg);
};

/* ── donut (podiel platforiem) ──────────────────────────── */
SP.donut = function (el, casti, opts = {}) {
  el.innerHTML = "";
  const fmt = opts.format || SP.fmt.mena;
  const spolu = casti.reduce((s, c) => s + c.value, 0);
  if (spolu <= 0) {
    el.innerHTML = `<p class="graf-prazdny">Žiadne dáta.</p>`;
    return;
  }
  const R = 70, r = 44, S = 170;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${S} ${S}`);
  svg.style.maxWidth = "220px";
  svg.style.margin = "0 auto";
  svg.style.display = "block";

  let uhol = -Math.PI / 2;
  for (const c of casti) {
    const podiel = c.value / spolu;
    const koniec = uhol + podiel * Math.PI * 2;
    const velky = podiel > 0.5 ? 1 : 0;
    const x1 = S / 2 + R * Math.cos(uhol), y1 = S / 2 + R * Math.sin(uhol);
    const x2 = S / 2 + R * Math.cos(koniec), y2 = S / 2 + R * Math.sin(koniec);
    const x3 = S / 2 + r * Math.cos(koniec), y3 = S / 2 + r * Math.sin(koniec);
    const x4 = S / 2 + r * Math.cos(uhol), y4 = S / 2 + r * Math.sin(uhol);
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d",
      `M ${x1} ${y1} A ${R} ${R} 0 ${velky} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${velky} 0 ${x4} ${y4} Z`);
    path.setAttribute("fill", c.farba);
    path.setAttribute("class", "stlpec");
    path.addEventListener("mousemove", ev =>
      SP.tooltip.ukaz(`<strong>${c.label}</strong>${fmt(c.value)} · ${SP.fmt.pct1(podiel * 100)}`, ev.clientX, ev.clientY));
    path.addEventListener("mouseleave", () => SP.tooltip.skry());
    svg.appendChild(path);
    uhol = koniec;
  }
  el.appendChild(svg);

  const legenda = document.createElement("div");
  legenda.className = "graf-legenda";
  legenda.style.justifyContent = "center";
  for (const c of casti) {
    const podiel = SP.fmt.pct1((c.value / spolu) * 100);
    const span = document.createElement("span");
    span.className = "lg";
    span.innerHTML = `<i style="background:${c.farba}"></i>${c.label} · ${podiel}`;
    legenda.appendChild(span);
  }
  el.appendChild(legenda);
};

/* ── lievik ─────────────────────────────────────────────── */
SP.lievik = function (el, kroky) {
  el.innerHTML = "";
  const max = Math.max(...kroky.map(k => k.value), 1);
  const obal = document.createElement("div");
  obal.className = "lievik";
  kroky.forEach((k, i) => {
    const pct = i === 0 ? null : SP.div(k.value, kroky[i - 1].value) * 100;
    const div = document.createElement("div");
    div.className = "lievik-krok";
    div.innerHTML = `
      <div class="lievik-info">
        <div class="lievik-nazov">${k.label}</div>
        <div class="lievik-cislo">${SP.fmt.cislo(k.value)}</div>
        ${k.sub ? `<div class="lievik-sub">${k.sub}</div>` : ""}
      </div>
      <div class="lievik-pruh-obal">
        <div class="lievik-pruh" style="width:${Math.max((k.value / max) * 100, 1)}%; background:${k.farba || "var(--primar)"}"></div>
        ${pct != null ? `<span class="lievik-pct">${SP.fmt.pct1(pct)} z predošlého kroku</span>` : ""}
      </div>`;
    obal.appendChild(div);
  });
  el.appendChild(obal);
};
