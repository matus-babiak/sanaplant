/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · načítanie dát a agregácie
   ═══════════════════════════════════════════════════════════ */
window.SP = window.SP || {};

SP.store = {
  google: new Map(),   // "YYYY-MM" -> záznam z SP.parseGoogle
  meta: new Map(),     // "YYYY-MM" -> záznam z SP.parseMeta
  komentare: {},       // "YYYY-MM" -> { prehlad, google, meta }
  chyby: []
};

/* ── práca s mesiacmi ("YYYY-MM") ───────────────────────── */
SP.mesiacNaIndex = m => { const [r, mm] = m.split("-").map(Number); return r * 12 + (mm - 1); };
SP.indexNaMesiac = i => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

SP.rozsahMesiacov = function (od, do_) {
  const a = SP.mesiacNaIndex(od), b = SP.mesiacNaIndex(do_);
  const out = [];
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(SP.indexNaMesiac(i));
  return out;
};

/* posun celého rozsahu o jeho dĺžku dozadu (predošlé obdobie) */
SP.predosleObdobie = mesiace => {
  const n = mesiace.length;
  const start = SP.mesiacNaIndex(mesiace[0]) - n;
  return Array.from({ length: n }, (_, i) => SP.indexNaMesiac(start + i));
};

/* rovnaké obdobie o rok skôr */
SP.vlanajsieObdobie = mesiace => mesiace.map(m => SP.indexNaMesiac(SP.mesiacNaIndex(m) - 12));

SP.formatMesiac = function (m, kratky) {
  const [r, mm] = m.split("-").map(Number);
  const nazvy = kratky ? SP.MESIACE_SK_KRATKE : SP.MESIACE_SK;
  return `${nazvy[mm - 1]} ${kratky ? String(r).slice(2) : r}`;
};

SP.formatRozsah = function (mesiace) {
  if (!mesiace.length) return "—";
  const a = mesiace[0], b = mesiace[mesiace.length - 1];
  if (a === b) return SP.formatMesiac(a);
  return `${SP.formatMesiac(a)} – ${SP.formatMesiac(b)}`;
};

/* všetky mesiace, pre ktoré existujú dáta (union platforiem) */
SP.dostupneMesiace = function () {
  const s = new Set([...SP.store.google.keys(), ...SP.store.meta.keys()]);
  return [...s].sort();
};

/* ── načítanie všetkých súborov podľa manifestu ─────────── */
SP.nacitajVsetko = async function () {
  const manifest = await (await fetch("data-manifest.json", { cache: "no-store" })).json();
  const ulohy = [];
  for (const [platforma, subory] of Object.entries(manifest.subory || {})) {
    for (const f of subory) {
      ulohy.push(
        fetch(encodeURI(f), { cache: "no-store" })
          .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
          .then(text => ({ platforma, f, text }))
          .catch(() => ({ platforma, f, chyba: true }))
      );
    }
  }
  const vysledky = await Promise.all(ulohy);
  for (const v of vysledky) {
    if (v.chyba) { SP.store.chyby.push(v.f); continue; }
    try {
      const p = v.platforma.toLowerCase();
      if (p === "google") {
        const rec = SP.parseGoogle(v.text);
        if (rec.month) SP.store.google.set(rec.month, rec);
      } else if (p === "meta") {
        const rec = SP.parseMeta(v.text);
        if (rec.month) SP.store.meta.set(rec.month, rec);
      }
    } catch (e) {
      console.warn("Súbor sa nepodarilo spracovať:", v.f, e);
      SP.store.chyby.push(v.f);
    }
  }
  try {
    SP.store.komentare = await (await fetch("komentare.json", { cache: "no-store" })).json();
  } catch (e) { SP.store.komentare = {}; }
};

/* ── agregácia Google ───────────────────────────────────── */
SP.agregujGoogle = function (mesiace) {
  const a = { impressions: 0, interactions: 0, cost: 0, clicks: 0,
              purchases: 0, purchaseValue: 0, atc: 0, checkout: 0, maDate: false };
  const typy = {}, kampane = {};
  for (const m of mesiace) {
    const rec = SP.store.google.get(m);
    if (!rec) continue;
    a.maDate = true;
    for (const k of ["impressions", "interactions", "cost", "clicks", "purchases", "purchaseValue", "atc", "checkout"])
      a[k] += rec.account[k] || 0;
    for (const t of rec.types) {
      const o = typy[t.type] || (typy[t.type] = { type: t.type, impressions: 0, interactions: 0, cost: 0, clicks: 0 });
      o.impressions += t.impressions; o.interactions += t.interactions;
      o.cost += t.cost; o.clicks += t.clicks;
    }
    for (const c of rec.campaigns) {
      const o = kampane[c.name] || (kampane[c.name] = { name: c.name, type: c.type, bid: c.bid, purchases: 0, purchaseValue: 0, atc: 0, checkout: 0 });
      if (c.type) o.type = c.type;
      if (c.bid) o.bid = c.bid;
      o.purchases += c.purchases; o.purchaseValue += c.purchaseValue;
      o.atc += c.atc; o.checkout += c.checkout;
    }
  }
  // odvodené metriky
  a.ctr = SP.div(a.clicks, a.impressions) * 100;
  a.cpc = SP.div(a.cost, a.clicks);
  a.cpm = SP.div(a.cost, a.impressions) * 1000;
  a.avgCost = SP.div(a.cost, a.interactions);
  a.interactionRate = SP.div(a.interactions, a.impressions) * 100;
  a.roas = SP.div(a.purchaseValue, a.cost);
  a.convRate = SP.div(a.purchases, a.clicks) * 100;
  a.costPerPurchase = SP.div(a.cost, a.purchases);
  a.typy = Object.values(typy).sort((x, y) => y.cost - x.cost);
  a.kampane = Object.values(kampane)
    .filter(k => k.purchases || k.purchaseValue || k.atc || k.checkout)
    .sort((x, y) => y.purchaseValue - x.purchaseValue);
  return a;
};

/* ── agregácia Meta ─────────────────────────────────────── */
SP.agregujMeta = function (mesiace) {
  const a = { spend: 0, value: 0, purchases: 0, atc: 0, atcValue: 0, lpv: 0,
              impressions: 0, reach: 0, clicks: 0,
              engagements: 0, comments: 0, saves: 0, shares: 0, maDate: false };
  const kampane = {}, reklamy = {};
  for (const m of mesiace) {
    const rec = SP.store.meta.get(m);
    if (!rec) continue;
    a.maDate = true;
    for (const ad of rec.ads) {
      for (const k of ["spend", "value", "purchases", "atc", "atcValue", "lpv",
                       "impressions", "reach", "clicks", "engagements", "comments", "saves", "shares"])
        a[k] += ad[k] || 0;

      const kk = ad.campaign || "(bez kampane)";
      const c = kampane[kk] || (kampane[kk] = { name: kk, pocetReklam: new Set(),
        spend: 0, value: 0, purchases: 0, atc: 0, lpv: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0 });
      c.pocetReklam.add(ad.ad);
      for (const k of ["spend", "value", "purchases", "atc", "lpv", "impressions", "reach", "clicks", "engagements"])
        c[k] += ad[k] || 0;

      const rk = ad.ad + "‖" + kk;
      const r = reklamy[rk] || (reklamy[rk] = { ad: ad.ad, campaign: kk, status: ad.status, od: ad.od, do_: ad.do_,
        spend: 0, value: 0, purchases: 0, atc: 0, lpv: 0, impressions: 0, reach: 0, clicks: 0, engagements: 0 });
      r.status = ad.status; r.od = ad.od; r.do_ = ad.do_;
      for (const k of ["spend", "value", "purchases", "atc", "lpv", "impressions", "reach", "clicks", "engagements"])
        r[k] += ad[k] || 0;
    }
  }
  const odvod = o => {
    o.roas = SP.div(o.value, o.spend);
    o.cpa = SP.div(o.spend, o.purchases);
    o.cpm = SP.div(o.spend, o.impressions) * 1000;
    o.ctr = SP.div(o.clicks, o.impressions) * 100;
    o.cpc = SP.div(o.spend, o.clicks);
    o.freq = SP.div(o.impressions, o.reach);
  };
  odvod(a);
  a.costAtc = SP.div(a.spend, a.atc);
  a.costLpv = SP.div(a.spend, a.lpv);
  a.rateLpv = SP.div(a.purchases, a.lpv) * 100;
  a.rateClicks = SP.div(a.purchases, a.clicks) * 100;
  a.costEng = SP.div(a.spend, a.engagements);

  a.kampane = Object.values(kampane).map(c => { odvod(c); c.pocetReklam = c.pocetReklam.size; return c; })
    .sort((x, y) => y.spend - x.spend);
  a.reklamy = Object.values(reklamy).map(r => { odvod(r); return r; })
    .sort((x, y) => y.spend - x.spend);
  return a;
};

/* ── hodnota jednej metriky za jeden mesiac (pre grafy) ──── */
SP.metrikaZaMesiac = function (platforma, mesiac, metrika) {
  if (platforma === "google") {
    const rec = SP.store.google.get(mesiac);
    if (!rec) return null;
    const a = SP.agregujGoogle([mesiac]);
    return a[metrika] ?? null;
  }
  if (platforma === "meta") {
    if (!SP.store.meta.get(mesiac)) return null;
    const a = SP.agregujMeta([mesiac]);
    return a[metrika] ?? null;
  }
  return null;
};
