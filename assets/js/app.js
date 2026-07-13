/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · hlavná aplikácia
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const stav = {
    stranka: "prehlad",
    preset: "latest",
    od: null,          // "YYYY-MM"
    do: null,
    porovnanie: "previous"   // previous | yoy | none
  };

  const NAZVY_STRANOK = { prehlad: "Prehľad", google: "Google Ads", meta: "Meta Ads" };

  /* smer, ktorým je zmena metriky „dobrá“ */
  const SMER = {
    hore: ["value", "purchaseValue", "purchases", "roas", "impressions", "reach", "clicks", "ctr",
           "interactions", "interactionRate", "atc", "checkout", "lpv", "engagements",
           "convRate", "rateLpv", "rateClicks", "comments", "shares", "saves", "atcValue"],
    dole: ["cpa", "cpc", "cpm", "costPerPurchase", "avgCost", "costAtc", "costLpv", "costEng"]
  };
  function smerMetriky(k) {
    if (SMER.hore.includes(k)) return "hore";
    if (SMER.dole.includes(k)) return "dole";
    return "neutral"; // investícia, frekvencia…
  }

  /* ══════════ pomocníci UI ══════════ */
  const $ = sel => document.querySelector(sel);
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function formatDatum(d) {
    const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return d || "—";
    return `${+m[3]}. ${+m[2]}. ${m[1]}`;
  }

  /* ══════════ časové rozsahy ══════════ */
  function najnovsiMesiac() {
    const vsetky = SP.dostupneMesiace();
    return vsetky[vsetky.length - 1] || null;
  }
  function aktualnyMesiac() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function vypocitajRozsah() {
    const dnes = aktualnyMesiac();
    const rok = +dnes.split("-")[0];
    const vsetky = SP.dostupneMesiace();
    switch (stav.preset) {
      case "latest": {
        const m = najnovsiMesiac() || dnes;
        return [m, m];
      }
      case "thisMonth": return [dnes, dnes];
      case "lastMonth": {
        const m = SP.indexNaMesiac(SP.mesiacNaIndex(dnes) - 1);
        return [m, m];
      }
      case "thisYear": return [`${rok}-01`, dnes];
      case "lastYear": return [`${rok - 1}-01`, `${rok - 1}-12`];
      case "all": {
        if (!vsetky.length) return [dnes, dnes];
        return [vsetky[0], vsetky[vsetky.length - 1]];
      }
      case "custom": return [stav.od || dnes, stav.do || dnes];
      default: return [dnes, dnes];
    }
  }
  function aktualneMesiace() {
    const [od, do_] = vypocitajRozsah();
    return SP.rozsahMesiacov(od, do_);
  }
  function porovnavaneMesiace(mesiace) {
    if (stav.porovnanie === "previous") return SP.predosleObdobie(mesiace);
    if (stav.porovnanie === "yoy") return SP.vlanajsieObdobie(mesiace);
    return null;
  }

  /* ══════════ KPI karta ══════════ */
  function vytvorDelta(kluc, aktual, porovnanie, fmt) {
    const prev = porovnanie.maDate ? porovnanie[kluc] : null;
    if (prev == null || (prev === 0 && aktual[kluc] === 0))
      return { delta: el("div", "kpi-delta ziadne", "bez porovnania") };
    if (prev === 0)
      return { delta: el("div", "kpi-delta neutral", `<span class="sipka">▲</span> nové`) };
    const zmena = ((aktual[kluc] - prev) / Math.abs(prev)) * 100;
    const smer = smerMetriky(kluc);
    let trieda = "neutral";
    if (smer === "hore") trieda = zmena >= 0 ? "dobre" : "zle";
    if (smer === "dole") trieda = zmena <= 0 ? "dobre" : "zle";
    if (Math.abs(zmena) < 0.05) trieda = "neutral";
    const sipka = zmena >= 0 ? "▲" : "▼";
    return {
      delta: el("div", `kpi-delta ${trieda}`, `<span class="sipka">${sipka}</span> ${SP.fmt.pct1(Math.abs(zmena))}`),
      predtym: el("div", "kpi-porovnanie", `predtým ${fmt(prev)}`)
    };
  }
  function kpiKarta(label, kluc, aktual, porovnanie, fmt) {
    const karta = el("div", "kpi");
    karta.appendChild(el("div", "kpi-label", label));
    karta.appendChild(el("div", "kpi-hodnota", fmt(aktual[kluc])));
    if (porovnanie) {
      const d = vytvorDelta(kluc, aktual, porovnanie, fmt);
      karta.appendChild(d.delta);
      if (d.predtym) karta.appendChild(d.predtym);
    }
    return karta;
  }
  function kpiMriezka(defy, aktual, porovnanie, sekundarne) {
    const g = el("div", "kpi-mriezka" + (sekundarne ? " kpi-sekundarne" : ""));
    for (const [label, kluc, fmt] of defy) g.appendChild(kpiKarta(label, kluc, aktual, porovnanie, fmt));
    return g;
  }
  /* kompaktný zoznam štatistík (label vľavo, hodnota + zmena vpravo) */
  function statZoznam(defy, aktual, porovnanie) {
    const z = el("div", "stat-zoznam");
    for (const [label, kluc, fmt] of defy) {
      const r = el("div", "stat-riadok");
      r.appendChild(el("span", "nazov", label));
      const pravo = el("span", "hodnota");
      pravo.textContent = fmt(aktual[kluc]);
      if (porovnanie) {
        const d = vytvorDelta(kluc, aktual, porovnanie, fmt);
        if (!d.delta.classList.contains("ziadne")) {
          d.delta.style.marginLeft = "8px";
          pravo.appendChild(d.delta);
        }
      }
      r.appendChild(pravo);
      z.appendChild(r);
    }
    return z;
  }

  /* ══════════ tabuľka so zoraďovaním ══════════ */
  function tabulka({ stlpce, riadky, sucet, uvodneZoradenie }) {
    const obal = el("div", "tab-obal");
    const tab = el("table", "tabulka");
    let sortK = uvodneZoradenie || null, sortSmer = -1;

    function render() {
      tab.innerHTML = "";
      const thead = el("thead");
      const tr = el("tr");
      for (const s of stlpce) {
        const th = el("th", sortK === s.k ? "zoradene" : "");
        th.innerHTML = s.label + (sortK === s.k ? ` <span class="smer">${sortSmer < 0 ? "▼" : "▲"}</span>` : "");
        th.addEventListener("click", () => {
          if (sortK === s.k) sortSmer *= -1; else { sortK = s.k; sortSmer = s.text ? 1 : -1; }
          render();
        });
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      tab.appendChild(thead);

      let data = [...riadky];
      if (sortK) {
        const s = stlpce.find(x => x.k === sortK);
        data.sort((a, b) => {
          const av = a[sortK], bv = b[sortK];
          if (s && s.text) return String(av).localeCompare(String(bv), "sk") * sortSmer;
          return ((av || 0) - (bv || 0)) * sortSmer;
        });
      }

      const tbody = el("tbody");
      for (const r of data) {
        const tr = el("tr");
        for (const s of stlpce) {
          const td = el("td", s.text ? "bunka-text" : "");
          const v = r[s.k];
          td.innerHTML = s.render ? s.render(v, r) : (s.fmt ? s.fmt(v) : v);
          if (s.title) td.title = s.title(v, r);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      tab.appendChild(tbody);

      if (sucet) {
        const tfoot = el("tfoot");
        const tr = el("tr");
        stlpce.forEach((s, i) => {
          const td = el("td", s.text ? "bunka-text" : "");
          if (i === 0) td.textContent = "Spolu";
          else if (sucet[s.k] != null) td.innerHTML = s.fmt ? s.fmt(sucet[s.k]) : sucet[s.k];
          tr.appendChild(td);
        });
        tfoot.appendChild(tr);
        tab.appendChild(tfoot);
      }
    }
    render();
    obal.appendChild(tab);
    return obal;
  }

  /* ══════════ karta s grafom trendu ══════════ */
  function kartaTrendu({ titul, metriky, mesiace, cmpMesiace, serie }) {
    const karta = el("div", "karta");
    const hlava = el("div", "karta-hlavicka");
    hlava.appendChild(el("h2", null, titul));
    const prepinac = el("div", "graf-prepinac");
    hlava.appendChild(prepinac);
    karta.appendChild(hlava);
    const plocha = el("div", "graf-plocha");
    karta.appendChild(plocha);
    const legenda = el("div", "graf-legenda");
    karta.appendChild(legenda);

    let aktivna = metriky[0];

    function kresli() {
      const [, , fmt] = aktivna;
      const polozky = mesiace.map((m, i) => {
        const hodnoty = serie.map(s => ({
          nazov: s.nazov,
          farba: s.farba(),
          value: s.hodnota(m, aktivna[1])
        }));
        if (cmpMesiace) {
          const cm = cmpMesiace[i];
          hodnoty.push({
            nazov: `porovnanie (${SP.formatMesiac(cm, true)})`,
            farba: SP.FARBY.porovnanie(),
            value: serie.length === 1 ? serie[0].hodnota(cm, aktivna[1]) : sumaSerie(cm)
          });
        }
        return { label: SP.formatMesiac(m, true), tooltipLabel: SP.formatMesiac(m), hodnoty };
      });
      function sumaSerie(m) {
        let s = null;
        for (const ser of serie) {
          const v = ser.hodnota(m, aktivna[1]);
          if (v != null) s = (s || 0) + v;
        }
        return s;
      }
      SP.stlpcovyGraf(plocha, polozky, { format: fmt });

      legenda.innerHTML = "";
      const vsetkySerie = [...serie.map(s => ({ n: s.nazov, f: s.farba() }))];
      if (cmpMesiace) vsetkySerie.push({ n: "Porovnávané obdobie", f: SP.FARBY.porovnanie() });
      if (vsetkySerie.length > 1 || cmpMesiace) {
        for (const s of vsetkySerie) legenda.appendChild(el("span", "lg", `<i style="background:${s.f}"></i>${s.n}`));
      }

      // mesiace bez dát
      const chybajuce = mesiace.filter(m => serie.every(s => s.hodnota(m, aktivna[1]) == null));
      const stare = karta.querySelector(".upozornenie");
      if (stare) stare.remove();
      if (chybajuce.length && chybajuce.length < mesiace.length) {
        karta.appendChild(el("p", "upozornenie",
          `Bez nahraných dát: ${chybajuce.map(m => SP.formatMesiac(m)).join(", ")}`));
      }
    }

    for (const m of metriky) {
      const b = el("button", null, m[0]);
      if (m === aktivna) b.classList.add("aktivny");
      b.addEventListener("click", () => {
        aktivna = m;
        prepinac.querySelectorAll("button").forEach(x => x.classList.remove("aktivny"));
        b.classList.add("aktivny");
        kresli();
      });
      prepinac.appendChild(b);
    }

    kresli();
    karta._prekresli = kresli;
    return karta;
  }

  /* ══════════ automatický komentár k výsledkom ══════════ */
  const MESIACE_LOKAL = ["januári", "februári", "marci", "apríli", "máji", "júni",
                         "júli", "auguste", "septembri", "októbri", "novembri", "decembri"];

  function obdobieUvod(mesiace) {
    if (mesiace.length === 1) {
      const [r, m] = mesiace[0].split("-").map(Number);
      return `V ${MESIACE_LOKAL[m - 1]} ${r}`;
    }
    return `Za obdobie ${SP.formatRozsah(mesiace)}`;
  }
  function porovnaniePopis(cmpMesiace) {
    const zaklad = stav.porovnanie === "yoy" ? "rovnakému obdobiu vlani" : "predošlému obdobiu";
    return `${zaklad} (${SP.formatRozsah(cmpMesiace)})`;
  }
  /* skloňovanie: sklon(3, "nákup", "nákupy", "nákupov") */
  function sklon(n, jeden, dvaAzStyri, vela) {
    n = Math.round(n || 0);
    if (n === 1) return jeden;
    if (n >= 2 && n <= 4) return dvaAzStyri;
    return vela;
  }
  /* slovný popis zmeny; rod: "f" (investícia) / "m" (obrat) */
  function zmenaSlovo(now, prev, rod) {
    if (prev == null || prev === 0) return null;
    const pct = ((now - prev) / Math.abs(prev)) * 100;
    const abs = SP.fmt.pct1(Math.abs(pct));
    if (Math.abs(pct) < 3) return rod === "f" ? "zostala približne rovnaká" : "zostal približne rovnaký";
    if (pct > 0) return rod === "f" ? `vzrástla o ${abs}` : `vzrástol o ${abs}`;
    return rod === "f" ? `klesla o ${abs}` : `klesol o ${abs}`;
  }
  function vetaRoas(now, prev) {
    if (!prev || !now) return "";
    const pct = ((now - prev) / prev) * 100;
    if (Math.abs(pct) < 3) return ` Návratnosť zostala stabilná na úrovni ${SP.fmt.roas(now)}.`;
    return ` Návratnosť sa ${pct > 0 ? "zlepšila" : "znížila"} z ${SP.fmt.roas(prev)} na ${SP.fmt.roas(now)}.`;
  }
  function vetaZaklad(nazovReklam, o, mesiace) {
    if (o.value > 0) {
      return `${obdobieUvod(mesiace)} sa do ${nazovReklam} investovalo ${SP.fmt.mena(o.spend)}. ` +
        `Reklamy priniesli obrat ${SP.fmt.mena(o.value)} z ${SP.fmt.cislo(o.purchases)} ${sklon(o.purchases, "nákupu", "nákupov", "nákupov")}, ` +
        `návratnosť investície dosiahla ${SP.fmt.roas(o.roas)}.`;
    }
    return `${obdobieUvod(mesiace)} sa do ${nazovReklam} investovalo ${SP.fmt.mena(o.spend)}. ` +
      `Reklamy získali ${SP.fmt.cislo(o.impressions)} zobrazení a ${SP.fmt.cislo(o.clicks)} ${sklon(o.clicks, "kliknutie", "kliknutia", "kliknutí")}; ` +
      `nákupy v tomto období nezaznamenali.`;
  }
  function vetaPorovnanie(o, cmp, cmpMesiace) {
    if (!cmp || !cmp.maDate) return null;
    const vI = zmenaSlovo(o.spend, cmp.spend, "f");
    const vO = zmenaSlovo(o.value, cmp.value, "m");
    if (!vI) return null;
    let veta = `Oproti ${porovnaniePopis(cmpMesiace)} investícia ${vI}`;
    veta += vO ? ` a obrat ${vO}.` : ".";
    veta += vetaRoas(o.roas, cmp.roas);
    return veta;
  }

  function autoVety(kluc, ctx) {
    const { mesiace, cmpMesiace } = ctx;
    const vety = [];

    if (kluc === "prehlad") {
      const { spolu, g, m, cmp } = ctx;
      const zjednot = { spend: spolu.spend, value: spolu.value, purchases: spolu.purchases,
                        roas: spolu.roas, impressions: spolu.impressions, clicks: spolu.clicks, maDate: spolu.maDate };
      vety.push(vetaZaklad("reklamy", zjednot, mesiace));
      const p = vetaPorovnanie(zjednot, cmp, cmpMesiace);
      if (p) vety.push(p);
      if (g.maDate && m.maDate && spolu.spend > 0) {
        const gPod = SP.fmt.pct1(SP.div(g.cost, spolu.spend) * 100);
        const mPod = SP.fmt.pct1(SP.div(m.spend, spolu.spend) * 100);
        vety.push(`Do Google Ads išlo ${gPod} investície, do Meta Ads ${mPod}.`);
        if (g.purchaseValue > 0 && m.value > 0) {
          const lepsia = g.roas >= m.roas ? "Google Ads" : "Meta Ads";
          const lepsiRoas = Math.max(g.roas, m.roas);
          vety.push(`Vyššiu návratnosť dosiahol ${lepsia} (${SP.fmt.roas(lepsiRoas)}).`);
        }
      }
    }

    if (kluc === "google") {
      const { a, cmp } = ctx;
      vety.push(vetaZaklad("reklám v Google Ads", { ...a, spend: a.cost, value: a.purchaseValue }, mesiace));
      const p = vetaPorovnanie({ spend: a.cost, value: a.purchaseValue, roas: a.roas }, cmp && { ...cmp, spend: cmp.cost, value: cmp.purchaseValue }, cmpMesiace);
      if (p) vety.push(p);
      const top = a.kampane.find(k => k.purchaseValue > 0);
      if (top) vety.push(`Najviac predajov priniesla kampaň „${top.name}“ – ${SP.fmt.mena(top.purchaseValue)} z ${SP.fmt.cislo(top.purchases)} ${sklon(top.purchases, "nákupu", "nákupov", "nákupov")}.`);
      if (a.clicks > 0) vety.push(`Reklamy sa zobrazili ${SP.fmt.cislo(a.impressions)}-krát a priniesli ${SP.fmt.cislo(a.clicks)} ${sklon(a.clicks, "kliknutie", "kliknutia", "kliknutí")} (CTR ${SP.fmt.pct(a.ctr)}).`);
    }

    if (kluc === "meta") {
      const { a, cmp } = ctx;
      vety.push(vetaZaklad("reklám v Meta Ads", a, mesiace));
      const p = vetaPorovnanie(a, cmp, cmpMesiace);
      if (p) vety.push(p);
      if (a.reach > 0) vety.push(`Reklamy oslovili ${SP.fmt.cislo(a.reach)} ľudí.`);
      const topK = [...a.kampane].sort((x, y) => y.value - x.value)[0];
      if (topK && topK.value > 0) vety.push(`Najviac predajov priniesla kampaň „${topK.name}“ (${SP.fmt.mena(topK.value)}, ROAS ${SP.fmt.roas(topK.roas)}).`);
      const topR = [...a.reklamy].sort((x, y) => y.value - x.value)[0];
      if (topR && topR.value > 0) vety.push(`Najúspešnejšou reklamou bola „${topR.ad}“ s obratom ${SP.fmt.mena(topR.value)}.`);
      if (a.engagements > 0) vety.push(`Príspevky získali ${SP.fmt.cislo(a.engagements)} interakcií, ${SP.fmt.cislo(a.shares)} zdieľaní a ${SP.fmt.cislo(a.comments)} ${sklon(a.comments, "komentár", "komentáre", "komentárov")}.`);
    }

    return vety;
  }

  /* karta: automatické zhrnutie + voliteľná poznámka správcu z komentare.json */
  function kartaKomentara(mesiace, kluc, vety) {
    const karta = el("div", "karta komentar");
    karta.appendChild(el("div", "karta-hlavicka",
      "<h2>Komentár k výsledkom</h2><span class='karta-pozn'>generované automaticky z dát</span>"));
    if (vety && vety.length) karta.appendChild(el("p", "komentar-auto", vety.join(" ")));

    const zaznamy = mesiace
      .map(m => ({ m, text: (SP.store.komentare[m] || {})[kluc] }))
      .filter(z => z.text && z.text.trim());
    for (const z of zaznamy) {
      const blok = el("div", "komentar-mesiac");
      blok.appendChild(el("h3", null, `Poznámka správcu · ${SP.formatMesiac(z.m)}`));
      blok.appendChild(el("p", null, z.text));
      karta.appendChild(blok);
    }
    return karta;
  }

  /* ══════════ stránka: Prehľad ══════════ */
  function renderPrehlad(obsah, mesiace, cmpMesiace) {
    const g = SP.agregujGoogle(mesiace);
    const m = SP.agregujMeta(mesiace);
    const spolu = zluc(g, m);
    let cmp = null;
    if (cmpMesiace) cmp = zluc(SP.agregujGoogle(cmpMesiace), SP.agregujMeta(cmpMesiace));

    function zluc(g, m) {
      const o = {
        maDate: g.maDate || m.maDate,
        spend: g.cost + m.spend,
        value: g.purchaseValue + m.value,
        purchases: g.purchases + m.purchases,
        impressions: g.impressions + m.impressions,
        clicks: g.clicks + m.clicks
      };
      o.roas = SP.div(o.value, o.spend);
      o.cpa = SP.div(o.spend, o.purchases);
      o.ctr = SP.div(o.clicks, o.impressions) * 100;
      o.cpc = SP.div(o.spend, o.clicks);
      return o;
    }

    if (!spolu.maDate) return prazdnyStav(obsah);

    obsah.appendChild(kpiMriezka([
      ["Investícia do reklamy", "spend", SP.fmt.mena],
      ["Obrat z reklám", "value", SP.fmt.mena],
      ["Návratnosť (ROAS)", "roas", SP.fmt.roas],
      ["Nákupy", "purchases", SP.fmt.cislo],
      ["Cena za nákup", "cpa", SP.fmt.mena]
    ], spolu, cmp));

    obsah.appendChild(kpiMriezka([
      ["Impresie", "impressions", SP.fmt.cislo],
      ["Kliknutia", "clicks", SP.fmt.cislo],
      ["CTR", "ctr", SP.fmt.pct],
      ["Cena za klik", "cpc", SP.fmt.mena]
    ], spolu, cmp, true));

    // trend + podiel platforiem
    const mriezka = el("div", "mriezka-2");
    const trend = kartaTrendu({
      titul: "Vývoj v čase",
      mesiace, cmpMesiace: null,
      metriky: [
        ["Investícia", "spend", SP.fmt.menaKratka],
        ["Obrat", "value", SP.fmt.menaKratka],
        ["Nákupy", "purchases", SP.fmt.cislo],
        ["ROAS", "roas", SP.fmt.roas]
      ],
      serie: [
        { nazov: "Google Ads", farba: () => SP.FARBY.primar(),
          hodnota: (mes, k) => gHodnota(mes, k) },
        { nazov: "Meta Ads", farba: () => SP.FARBY.oranz,
          hodnota: (mes, k) => mHodnota(mes, k) }
      ]
    });
    function gHodnota(mes, k) {
      const map = { spend: "cost", value: "purchaseValue", purchases: "purchases", roas: "roas" };
      return SP.metrikaZaMesiac("google", mes, map[k] || k);
    }
    function mHodnota(mes, k) {
      return SP.metrikaZaMesiac("meta", mes, k);
    }
    mriezka.appendChild(trend);

    const podiel = el("div", "karta");
    podiel.appendChild(el("div", "karta-hlavicka", "<h2>Podiel investície</h2>"));
    const donutEl = el("div", "graf-plocha");
    podiel.appendChild(donutEl);
    SP.donut(donutEl, [
      { label: "Google Ads", value: g.cost, farba: SP.FARBY.primar() },
      { label: "Meta Ads", value: m.spend, farba: SP.FARBY.oranz }
    ]);
    mriezka.appendChild(podiel);
    obsah.appendChild(mriezka);

    // porovnanie platforiem
    const porovKarta = el("div", "karta");
    porovKarta.appendChild(el("div", "karta-hlavicka", "<h2>Platformy vedľa seba</h2>"));
    const riadkyMetrik = [
      ["Investícia", x => SP.fmt.mena(x.spend)],
      ["Obrat z reklám", x => SP.fmt.mena(x.value)],
      ["ROAS", x => SP.fmt.roas(x.roas)],
      ["Nákupy", x => SP.fmt.cislo(x.purchases)],
      ["Cena za nákup", x => x.purchases ? SP.fmt.mena(x.cpa) : "—"],
      ["Impresie", x => SP.fmt.cislo(x.impressions)],
      ["Kliknutia", x => SP.fmt.cislo(x.clicks)],
      ["CTR", x => SP.fmt.pct(x.ctr)],
      ["Cena za klik", x => SP.fmt.mena(x.cpc)]
    ];
    const gN = { spend: g.cost, value: g.purchaseValue, roas: g.roas, purchases: g.purchases,
                 cpa: g.costPerPurchase, impressions: g.impressions, clicks: g.clicks, ctr: g.ctr, cpc: g.cpc };
    const mN = { spend: m.spend, value: m.value, roas: m.roas, purchases: m.purchases,
                 cpa: m.cpa, impressions: m.impressions, clicks: m.clicks, ctr: m.ctr, cpc: m.cpc };
    const sN = { spend: spolu.spend, value: spolu.value, roas: spolu.roas, purchases: spolu.purchases,
                 cpa: spolu.cpa, impressions: spolu.impressions, clicks: spolu.clicks, ctr: spolu.ctr, cpc: spolu.cpc };
    const obalT = el("div", "tab-obal");
    const t = el("table", "tabulka");
    t.innerHTML = `<thead><tr><th style="cursor:default">Metrika</th><th style="cursor:default">Google Ads</th><th style="cursor:default">Meta Ads</th><th style="cursor:default">Spolu</th></tr></thead>`;
    const tb = el("tbody");
    for (const [nazov, fmt] of riadkyMetrik) {
      const tr = el("tr");
      tr.appendChild(el("td", "bunka-text", nazov));
      tr.appendChild(el("td", null, g.maDate ? fmt(gN) : "—"));
      tr.appendChild(el("td", null, m.maDate ? fmt(mN) : "—"));
      tr.appendChild(el("td", null, `<strong>${fmt(sN)}</strong>`));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    obalT.appendChild(t);
    porovKarta.appendChild(obalT);
    obsah.appendChild(porovKarta);

    obsah.appendChild(kartaKomentara(mesiace, "prehlad",
      autoVety("prehlad", { mesiace, cmpMesiace, spolu, g, m, cmp })));
  }

  /* ══════════ stránka: Google Ads ══════════ */
  function renderGoogle(obsah, mesiace, cmpMesiace) {
    const a = SP.agregujGoogle(mesiace);
    const cmp = cmpMesiace ? SP.agregujGoogle(cmpMesiace) : null;
    if (!a.maDate) return prazdnyStav(obsah);

    obsah.appendChild(kpiMriezka([
      ["Investícia", "cost", SP.fmt.mena],
      ["Hodnota nákupov", "purchaseValue", SP.fmt.mena],
      ["Návratnosť (ROAS)", "roas", SP.fmt.roas],
      ["Nákupy", "purchases", SP.fmt.cislo],
      ["Cena za nákup", "costPerPurchase", SP.fmt.mena]
    ], a, cmp));

    obsah.appendChild(kpiMriezka([
      ["Impresie", "impressions", SP.fmt.cislo],
      ["Kliknutia", "clicks", SP.fmt.cislo],
      ["CTR", "ctr", SP.fmt.pct],
      ["Cena za klik", "cpc", SP.fmt.mena],
      ["CPM", "cpm", SP.fmt.mena],
      ["Interakcie", "interactions", SP.fmt.cislo],
      ["Miera interakcií", "interactionRate", SP.fmt.pct],
      ["Miera konverzie", "convRate", SP.fmt.pct]
    ], a, cmp, true));

    obsah.appendChild(kartaTrendu({
      titul: "Vývoj v čase",
      mesiace, cmpMesiace,
      metriky: [
        ["Investícia", "cost", SP.fmt.menaKratka],
        ["Hodnota nákupov", "purchaseValue", SP.fmt.menaKratka],
        ["ROAS", "roas", SP.fmt.roas],
        ["Nákupy", "purchases", SP.fmt.cislo],
        ["Kliknutia", "clicks", SP.fmt.cislo],
        ["Impresie", "impressions", SP.fmt.cislo]
      ],
      serie: [{ nazov: "Google Ads", farba: () => SP.FARBY.primar(),
                hodnota: (m, k) => SP.metrikaZaMesiac("google", m, k) }]
    }));

    // lievik + typy kampaní
    const mriezka = el("div", "mriezka-rovna");
    const lievikKarta = el("div", "karta");
    lievikKarta.appendChild(el("div", "karta-hlavicka",
      "<h2>Nákupný lievik</h2><span class='karta-pozn'>konverzie: nákup + košík + pokladňa</span>"));
    const lievikEl = el("div");
    lievikKarta.appendChild(lievikEl);
    SP.lievik(lievikEl, [
      { label: "Kliknutia", value: a.clicks },
      { label: "Pridania do košíka", value: a.atc },
      { label: "Začatia pokladne", value: a.checkout },
      { label: "Nákupy", value: a.purchases, farba: SP.FARBY.oranz,
        sub: a.purchases ? `hodnota ${SP.fmt.mena(a.purchaseValue)}` : "" }
    ]);
    mriezka.appendChild(lievikKarta);

    const typyKarta = el("div", "karta");
    typyKarta.appendChild(el("div", "karta-hlavicka", "<h2>Typy kampaní</h2>"));
    typyKarta.appendChild(tabulka({
      stlpce: [
        { k: "typ", label: "Typ kampane", text: true },
        { k: "cost", label: "Investícia", fmt: SP.fmt.mena },
        { k: "impressions", label: "Impresie", fmt: SP.fmt.cislo },
        { k: "clicks", label: "Kliknutia", fmt: SP.fmt.cislo },
        { k: "ctr", label: "CTR", fmt: SP.fmt.pct },
        { k: "cpc", label: "CPC", fmt: SP.fmt.mena }
      ],
      riadky: a.typy.map(t => ({
        typ: SP.TYP_KAMPANE[t.type] || t.type,
        cost: t.cost, impressions: t.impressions, clicks: t.clicks,
        ctr: SP.div(t.clicks, t.impressions) * 100,
        cpc: SP.div(t.cost, t.clicks)
      })),
      uvodneZoradenie: "cost"
    }));
    mriezka.appendChild(typyKarta);
    obsah.appendChild(mriezka);

    // kampane
    const kampKarta = el("div", "karta");
    kampKarta.appendChild(el("div", "karta-hlavicka",
      "<h2>Kampane</h2><span class='karta-pozn'>konverzie podľa kampaní</span>"));
    kampKarta.appendChild(tabulka({
      stlpce: [
        { k: "name", label: "Kampaň", text: true },
        { k: "typ", label: "Typ", text: true },
        { k: "bid", label: "Stratégia ponúk", text: true },
        { k: "purchases", label: "Nákupy", fmt: SP.fmt.cislo },
        { k: "purchaseValue", label: "Hodnota nákupov", fmt: SP.fmt.mena },
        { k: "atc", label: "Pridania do košíka", fmt: SP.fmt.cislo },
        { k: "checkout", label: "Začatia pokladne", fmt: SP.fmt.cislo }
      ],
      riadky: a.kampane.map(k => ({ ...k, typ: SP.TYP_KAMPANE[k.type] || k.type })),
      sucet: { purchases: a.purchases, purchaseValue: a.purchaseValue, atc: a.atc, checkout: a.checkout },
      uvodneZoradenie: "purchaseValue"
    }));
    kampKarta.appendChild(el("p", "upozornenie",
      "Export Google Ads obsahuje investíciu, impresie a kliknutia len za celý účet a typ kampane, preto tabuľka kampaní zobrazuje konverzné metriky."));
    obsah.appendChild(kampKarta);

    obsah.appendChild(kartaKomentara(mesiace, "google",
      autoVety("google", { mesiace, cmpMesiace, a, cmp })));
  }

  /* ══════════ stránka: Meta Ads ══════════ */
  function renderMeta(obsah, mesiace, cmpMesiace) {
    const a = SP.agregujMeta(mesiace);
    const cmp = cmpMesiace ? SP.agregujMeta(cmpMesiace) : null;
    if (!a.maDate) return prazdnyStav(obsah);

    obsah.appendChild(kpiMriezka([
      ["Investícia", "spend", SP.fmt.mena],
      ["Hodnota nákupov", "value", SP.fmt.mena],
      ["Návratnosť (ROAS)", "roas", SP.fmt.roas],
      ["Nákupy", "purchases", SP.fmt.cislo],
      ["Cena za nákup", "cpa", SP.fmt.mena]
    ], a, cmp));

    obsah.appendChild(kpiMriezka([
      ["Impresie", "impressions", SP.fmt.cislo],
      ["Dosah", "reach", SP.fmt.cislo],
      ["Frekvencia", "freq", SP.fmt.des1],
      ["CPM", "cpm", SP.fmt.mena],
      ["Kliknutia", "clicks", SP.fmt.cislo],
      ["Cena za klik", "cpc", SP.fmt.mena],
      ["CTR", "ctr", SP.fmt.pct],
      ["Pozretia stránky", "lpv", SP.fmt.cislo]
    ], a, cmp, true));

    obsah.appendChild(kartaTrendu({
      titul: "Vývoj v čase",
      mesiace, cmpMesiace,
      metriky: [
        ["Investícia", "spend", SP.fmt.menaKratka],
        ["Hodnota nákupov", "value", SP.fmt.menaKratka],
        ["ROAS", "roas", SP.fmt.roas],
        ["Nákupy", "purchases", SP.fmt.cislo],
        ["Kliknutia", "clicks", SP.fmt.cislo],
        ["Impresie", "impressions", SP.fmt.cislo]
      ],
      serie: [{ nazov: "Meta Ads", farba: () => SP.FARBY.oranz,
                hodnota: (m, k) => SP.metrikaZaMesiac("meta", m, k) }]
    }));

    // lievik + interakcie
    const mriezka = el("div", "mriezka-rovna");
    const lievikKarta = el("div", "karta");
    lievikKarta.appendChild(el("div", "karta-hlavicka", "<h2>Nákupný lievik</h2>"));
    const lievikEl = el("div");
    lievikKarta.appendChild(lievikEl);
    SP.lievik(lievikEl, [
      { label: "Kliknutia na web", value: a.clicks,
        sub: a.clicks ? `cena ${SP.fmt.mena(a.cpc)}` : "" },
      { label: "Pozretia stránky", value: a.lpv,
        sub: a.lpv ? `cena ${SP.fmt.mena(a.costLpv)}` : "" },
      { label: "Pridania do košíka", value: a.atc,
        sub: a.atc ? `cena ${SP.fmt.mena(a.costAtc)} · hodnota ${SP.fmt.mena(a.atcValue)}` : "" },
      { label: "Nákupy", value: a.purchases, farba: SP.FARBY.oranz,
        sub: a.purchases ? `hodnota ${SP.fmt.mena(a.value)}` : "" }
    ]);
    lievikKarta.appendChild(el("p", "upozornenie",
      `Miera nákupov: ${SP.fmt.pct(a.rateClicks)} z kliknutí · ${SP.fmt.pct(a.rateLpv)} z pozretí stránky`));
    mriezka.appendChild(lievikKarta);

    const engKarta = el("div", "karta");
    engKarta.appendChild(el("div", "karta-hlavicka", "<h2>Interakcie s obsahom</h2>"));
    engKarta.appendChild(statZoznam([
      ["Interakcie s príspevkami", "engagements", SP.fmt.cislo],
      ["Cena za interakciu", "costEng", SP.fmt.mena],
      ["Komentáre", "comments", SP.fmt.cislo],
      ["Zdieľania", "shares", SP.fmt.cislo],
      ["Uloženia", "saves", SP.fmt.cislo]
    ], a, cmp));
    mriezka.appendChild(engKarta);
    obsah.appendChild(mriezka);

    // kampane
    const kampKarta = el("div", "karta");
    kampKarta.appendChild(el("div", "karta-hlavicka", "<h2>Kampane</h2>"));
    kampKarta.appendChild(tabulka({
      stlpce: [
        { k: "name", label: "Kampaň", text: true },
        { k: "pocetReklam", label: "Reklamy", fmt: SP.fmt.cislo },
        { k: "spend", label: "Investícia", fmt: SP.fmt.mena },
        { k: "value", label: "Hodnota nákupov", fmt: SP.fmt.mena },
        { k: "roas", label: "ROAS", fmt: v => v ? SP.fmt.roas(v) : "—" },
        { k: "purchases", label: "Nákupy", fmt: SP.fmt.cislo },
        { k: "atc", label: "Košíky", fmt: SP.fmt.cislo },
        { k: "lpv", label: "Pozretia stránky", fmt: SP.fmt.cislo },
        { k: "impressions", label: "Impresie", fmt: SP.fmt.cislo },
        { k: "clicks", label: "Kliknutia", fmt: SP.fmt.cislo },
        { k: "ctr", label: "CTR", fmt: SP.fmt.pct }
      ],
      riadky: a.kampane,
      sucet: { spend: a.spend, value: a.value, roas: a.roas, purchases: a.purchases,
               atc: a.atc, lpv: a.lpv, impressions: a.impressions, clicks: a.clicks, ctr: a.ctr },
      uvodneZoradenie: "spend"
    }));
    obsah.appendChild(kampKarta);

    // reklamy s filtrom kampane
    const reklKarta = el("div", "karta");
    const hlava = el("div", "karta-hlavicka");
    hlava.appendChild(el("h2", null, "Reklamy"));
    const filter = el("select", "vstup");
    filter.innerHTML = `<option value="">Všetky kampane</option>` +
      a.kampane.map(k => `<option value="${k.name.replace(/"/g, "&quot;")}">${k.name}</option>`).join("");
    hlava.appendChild(filter);
    reklKarta.appendChild(hlava);
    const tabObal = el("div");
    reklKarta.appendChild(tabObal);

    function kresliReklamy() {
      tabObal.innerHTML = "";
      const riadky = a.reklamy.filter(r => !filter.value || r.campaign === filter.value);
      tabObal.appendChild(tabulka({
        stlpce: [
          { k: "ad", label: "Reklama", text: true },
          { k: "campaign", label: "Kampaň", text: true },
          { k: "status", label: "Stav", text: true, render: v => {
              const s = SP.STAV_META[v] || { text: v || "—", trieda: "neaktivna" };
              return `<span class="stav-chip ${s.trieda}">${s.text}</span>`;
            } },
          { k: "od", label: "Od", text: true, render: v => formatDatum(v) },
          { k: "do_", label: "Do", text: true, render: v => /^\d{4}/.test(v) ? formatDatum(v) : (v === "Prebieha" ? "prebieha" : (v || "—")) },
          { k: "spend", label: "Investícia", fmt: SP.fmt.mena },
          { k: "value", label: "Hodnota nákupov", fmt: v => v ? SP.fmt.mena(v) : "—" },
          { k: "roas", label: "ROAS", fmt: v => v ? SP.fmt.roas(v) : "—" },
          { k: "purchases", label: "Nákupy", fmt: v => v ? SP.fmt.cislo(v) : "—" },
          { k: "atc", label: "Košíky", fmt: v => v ? SP.fmt.cislo(v) : "—" },
          { k: "lpv", label: "Pozretia", fmt: SP.fmt.cislo },
          { k: "impressions", label: "Impresie", fmt: SP.fmt.cislo },
          { k: "clicks", label: "Kliknutia", fmt: SP.fmt.cislo },
          { k: "ctr", label: "CTR", fmt: SP.fmt.pct }
        ],
        riadky,
        uvodneZoradenie: "spend"
      }));
    }
    filter.addEventListener("change", kresliReklamy);
    kresliReklamy();
    obsah.appendChild(reklKarta);

    obsah.appendChild(kartaKomentara(mesiace, "meta",
      autoVety("meta", { mesiace, cmpMesiace, a, cmp })));
  }

  /* ══════════ prázdny stav ══════════ */
  function prazdnyStav(obsah) {
    obsah.appendChild(el("div", "karta prazdny-stav",
      `<h2>Za zvolené obdobie nie sú nahrané žiadne dáta</h2>
       <p>Vyberte iné obdobie alebo nahrajte mesačné exporty do zložky <strong>Dáta</strong>.</p>`));
  }

  /* ══════════ hlavné vykreslenie ══════════ */
  function render() {
    const mesiace = aktualneMesiace();
    const cmpMesiace = porovnavaneMesiace(mesiace);

    document.querySelectorAll("#nav a").forEach(aEl =>
      aEl.classList.toggle("aktivny", aEl.dataset.page === stav.stranka));
    $("#titulok-stranky").textContent = NAZVY_STRANOK[stav.stranka] || "Prehľad";

    // lišta s obdobím
    const lista = $("#obdobie-lista");
    lista.innerHTML = "";
    lista.appendChild(el("span", "obdobie-chip", `Obdobie: <strong>${SP.formatRozsah(mesiace)}</strong>`));
    if (cmpMesiace) lista.appendChild(el("span", "obdobie-chip porovnanie",
      `Porovnávané s: <strong>${SP.formatRozsah(cmpMesiace)}</strong>`));

    const obsah = $("#obsah");
    obsah.innerHTML = "";
    if (stav.stranka === "google") renderGoogle(obsah, mesiace, cmpMesiace);
    else if (stav.stranka === "meta") renderMeta(obsah, mesiace, cmpMesiace);
    else renderPrehlad(obsah, mesiace, cmpMesiace);
  }

  /* ══════════ filtre a navigácia ══════════ */
  function nastavFiltre() {
    const preset = $("#f-preset"), vlastne = $("#f-vlastne"),
          od = $("#f-od"), doInp = $("#f-do"), porov = $("#f-porovnanie");

    const vsetky = SP.dostupneMesiace();
    if (vsetky.length) {
      od.min = doInp.min = vsetky[0];
      od.max = doInp.max = aktualnyMesiac();
    }
    const posledny = najnovsiMesiac() || aktualnyMesiac();
    stav.od = stav.do = posledny;
    od.value = doInp.value = posledny;

    preset.addEventListener("change", () => {
      stav.preset = preset.value;
      vlastne.hidden = stav.preset !== "custom";
      if (stav.preset === "custom") { stav.od = od.value; stav.do = doInp.value; }
      render();
    });
    od.addEventListener("change", () => {
      if (od.value) { stav.od = od.value; if (stav.do < stav.od) { stav.do = stav.od; doInp.value = stav.od; } render(); }
    });
    doInp.addEventListener("change", () => {
      if (doInp.value) { stav.do = doInp.value; if (stav.do < stav.od) { stav.od = stav.do; od.value = stav.do; } render(); }
    });
    porov.addEventListener("change", () => { stav.porovnanie = porov.value; render(); });
  }

  function nastavNavigaciu() {
    function zHashu() {
      const p = (location.hash.replace("#/", "") || "prehlad");
      stav.stranka = NAZVY_STRANOK[p] ? p : "prehlad";
      render();
    }
    window.addEventListener("hashchange", zHashu);
    zHashu();
  }

  function nastavTemu() {
    const ulozena = localStorage.getItem("sp-tema");
    if (ulozena) document.documentElement.dataset.theme = ulozena;
    $("#btn-tema").addEventListener("click", () => {
      const nova = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nova;
      localStorage.setItem("sp-tema", nova);
      render();
    });
    $("#btn-odhlasit").addEventListener("click", () => SP.auth.odhlas());
  }

  /* ══════════ štart ══════════ */
  async function spustiApp() {
    $("#auth").hidden = true;
    $("#nacitavanie").hidden = false;
    await SP.nacitajVsetko();
    $("#nacitavanie").hidden = true;
    $("#app").hidden = false;

    const posledny = najnovsiMesiac();
    $("#info-data").textContent = posledny
      ? `Posledné dáta: ${SP.formatMesiac(posledny)}`
      : "Zatiaľ žiadne dáta";
    if (SP.store.chyby.length)
      console.warn("Nepodarilo sa načítať súbory:", SP.store.chyby);

    nastavFiltre();
    nastavNavigaciu();
  }

  document.addEventListener("DOMContentLoaded", () => {
    nastavTemu();

    let casovac = null;
    window.addEventListener("resize", () => {
      clearTimeout(casovac);
      casovac = setTimeout(() => { if (!$("#app").hidden) render(); }, 200);
    });

    if (SP.auth.jePrihlaseny()) { spustiApp(); return; }

    const auth = $("#auth");
    auth.hidden = false;
    $("#auth-form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const ok = await SP.auth.over($("#auth-heslo").value);
      if (ok) spustiApp();
      else {
        $("#auth-chyba").hidden = false;
        $("#auth-heslo").select();
      }
    });
  });
})();
