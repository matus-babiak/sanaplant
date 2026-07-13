/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · parsre mesačných exportov
   ═══════════════════════════════════════════════════════════ */
window.SP = window.SP || {};

/* ── Google Ads (Campaign report, segmentovaný podľa konverznej akcie) ──
   Výstup:
   {
     month: "2026-06",
     account: { impressions, interactions, cost, clicks,
                purchases, purchaseValue, atc, checkout },
     types:   [ { type, impressions, interactions, cost, clicks } ],
     campaigns: [ { name, type, bid, purchases, purchaseValue, atc, checkout } ]
   }
*/
SP.parseGoogle = function (text) {
  const rows = SP.parseCSV(text);

  const hi = rows.findIndex(r => r.includes("Conversion action") && r.includes("Campaign"));
  if (hi < 0) throw new Error("Neznámy formát Google exportu");

  // mesiac z riadku s rozsahom dátumov, napr. "1 June 2026 - 30 June 2026"
  let month = null;
  for (let i = 0; i < hi; i++) {
    const m = (rows[i][0] || "").match(/\d{1,2}\s+([A-Za-z]+)\s+(\d{4})/);
    if (m && SP.MESIACE_EN[m[1].toLowerCase()]) {
      month = `${m[2]}-${String(SP.MESIACE_EN[m[1].toLowerCase()]).padStart(2, "0")}`;
      break;
    }
  }

  const H = rows[hi];
  const ix = n => H.indexOf(n);
  const col = {
    action: ix("Conversion action"), cstat: ix("Campaign status"),
    camp: ix("Campaign"), type: ix("Campaign type"), bid: ix("Bid strategy type"),
    impr: ix("Impr."), inter: ix("Interactions"), cost: ix("Cost"), clicks: ix("Clicks"),
    convValue: ix("Conv. value"), conv: ix("Conversions")
  };

  const account = { impressions: 0, interactions: 0, cost: 0, clicks: 0,
                    purchases: 0, purchaseValue: 0, atc: 0, checkout: 0 };
  const types = {};
  const camps = {};
  const get = (r, c) => (c >= 0 && r[c] != null ? String(r[c]).trim() : "");

  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 10) continue;
    const cstat = get(r, col.cstat);
    const action = get(r, col.action);
    const akcia = SP.mapujKonverziu(action);
    const jeSegment = action && action !== "--";

    if (cstat === "Total: Account") {
      if (!jeSegment) {
        account.impressions += SP.num(r[col.impr]);
        account.interactions += SP.num(r[col.inter]);
        account.cost += SP.num(r[col.cost]);
        account.clicks += SP.num(r[col.clicks]);
      } else if (akcia) {
        account[akcia === "purchases" ? "purchases" : akcia] += SP.num(r[col.conv]);
        if (akcia === "purchases") account.purchaseValue += SP.num(r[col.convValue]);
      }
      continue;
    }

    if (cstat.startsWith("Total:")) {
      if (cstat === "Total: Filtered campaigns") continue;
      if (jeSegment) continue; // konverzie za typ kampane nepotrebujeme
      const typ = get(r, col.type) || cstat.replace("Total: ", "");
      const t = types[typ] || (types[typ] = { type: typ, impressions: 0, interactions: 0, cost: 0, clicks: 0 });
      t.impressions += SP.num(r[col.impr]);
      t.interactions += SP.num(r[col.inter]);
      t.cost += SP.num(r[col.cost]);
      t.clicks += SP.num(r[col.clicks]);
      continue;
    }

    // riadok kampane (kampaň × konverzná akcia)
    const nazov = get(r, col.camp);
    if (!nazov || nazov === "--") continue;
    const c = camps[nazov] || (camps[nazov] = {
      name: nazov, type: get(r, col.type), bid: get(r, col.bid),
      purchases: 0, purchaseValue: 0, atc: 0, checkout: 0
    });
    if (akcia === "purchases") { c.purchases += SP.num(r[col.conv]); c.purchaseValue += SP.num(r[col.convValue]); }
    else if (akcia === "atc") c.atc += SP.num(r[col.conv]);
    else if (akcia === "checkout") c.checkout += SP.num(r[col.conv]);
  }

  return {
    month,
    account,
    types: Object.values(types).filter(t => t.impressions || t.cost || t.clicks),
    campaigns: Object.values(camps)
  };
};

/* ── Meta Ads (export reklám s hlavičkou v slovenčine) ──
   Výstup: { month: "2026-06", ads: [ { ad, campaign, status, od, do_, spend, value,
             purchases, atc, atcValue, lpv, impressions, reach, clicks,
             engagements, comments, saves, shares } ] }
*/
SP.parseMeta = function (text) {
  const rows = SP.parseCSV(text);
  const H = rows[0];
  const ix = n => H.indexOf(n);
  const col = {
    start: ix("Začiatok vykazovania"),
    ad: ix("Názov reklamy"), camp: ix("Názov kampane"), stav: ix("Doručovanie reklám"),
    od: ix("Spustenie"), koniec: ix("Koniec"),
    spend: ix("Minutá suma (EUR)"), value: ix("Purchases conversion value"),
    purchases: ix("Nákupy"),
    atc: ix("Pridania do košíka"), atcValue: ix("Hodnota konverzie pridaní do košíka"),
    lpv: ix("Pozretia cieľovej stránky"),
    impr: ix("Impresie"), reach: ix("Dosah"), clicks: ix("Odchodové kliknutia"),
    eng: ix("Post engagements"), kom: ix("Komentáre k príspevku"),
    ulo: ix("Uloženia príspevkov"), zdi: ix("Zdieľania príspevku")
  };
  if (col.ad < 0 || col.spend < 0) throw new Error("Neznámy formát Meta exportu");

  let month = null;
  const ads = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 10) continue;
    if (!month) {
      const m = String(r[col.start] || "").match(/^(\d{4})-(\d{2})/);
      if (m) month = `${m[1]}-${m[2]}`;
    }
    // odstráni neviditeľné znaky (zero-width space a pod.) z názvu reklamy
    const nazov = String(r[col.ad] || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!nazov) continue;
    ads.push({
      ad: nazov,
      campaign: String(r[col.camp] || "").trim(),
      status: String(r[col.stav] || "").trim(),
      od: String(r[col.od] || "").trim(),
      do_: String(r[col.koniec] || "").trim(),
      spend: SP.num(r[col.spend]),
      value: SP.num(r[col.value]),
      purchases: SP.num(r[col.purchases]),
      atc: SP.num(r[col.atc]),
      atcValue: SP.num(r[col.atcValue]),
      lpv: SP.num(r[col.lpv]),
      impressions: SP.num(r[col.impr]),
      reach: SP.num(r[col.reach]),
      clicks: SP.num(r[col.clicks]),
      engagements: SP.num(r[col.eng]),
      comments: SP.num(r[col.kom]),
      saves: SP.num(r[col.ulo]),
      shares: SP.num(r[col.zdi])
    });
  }
  return { month, ads };
};
