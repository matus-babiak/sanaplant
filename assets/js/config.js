/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · konfigurácia
   ═══════════════════════════════════════════════════════════ */
window.SP = window.SP || {};

/* Heslo do aplikácie (SHA-256 hash).
   Zmena hesla: otvor konzolu prehliadača (F12) na stránke aplikácie,
   napíš  await spHash("NoveHeslo")  a výsledný kód vlož sem. */
SP.HESLO_HASH = "480acb29644b5e9c59cd2fd94443b8d11c16fb3f9f7f043f9367be7c3cc6e772";

/* Mapovanie názvov konverzných akcií Google Ads na 3 hlavné konverzie.
   Všetko, čo obsahuje "purchase" → nákup, "add_to_cart" → košík,
   "begin_checkout" → pokladňa. Ostatné akcie (obchod_kategoria_produkt,
   25s_view, view_item…) sa do reportingu NEpočítajú. */
SP.mapujKonverziu = function (nazov) {
  const a = String(nazov || "").trim().toLowerCase();
  if (!a || a === "--") return null;
  if (a.includes("purchase")) return "purchases";
  if (a.includes("add_to_cart")) return "atc";
  if (a.includes("begin_checkout")) return "checkout";
  return null;
};

/* Slovenské názvy mesiacov */
SP.MESIACE_SK = ["január","február","marec","apríl","máj","jún",
                 "júl","august","september","október","november","december"];
SP.MESIACE_SK_KRATKE = ["jan","feb","mar","apr","máj","jún","júl","aug","sep","okt","nov","dec"];

/* Anglické názvy mesiacov (hlavička Google exportu) */
SP.MESIACE_EN = { january:1, february:2, march:3, april:4, may:5, june:6,
                  july:7, august:8, september:9, october:10, november:11, december:12 };

/* Preklady stavov Meta reklám */
SP.STAV_META = {
  active:          { text: "Aktívna",       trieda: "aktivna" },
  inactive:        { text: "Neaktívna",     trieda: "neaktivna" },
  not_delivering:  { text: "Nedoručuje sa", trieda: "nedorucuje" },
  archived:        { text: "Archivovaná",   trieda: "neaktivna" },
  completed:       { text: "Ukončená",      trieda: "neaktivna" },
  recently_completed: { text: "Ukončená",   trieda: "neaktivna" }
};

/* Preklady typov kampaní Google */
SP.TYP_KAMPANE = {
  "Performance Max": "Performance Max",
  "Search": "Vyhľadávanie",
  "Display": "Obsahová sieť",
  "Shopping": "Nákupy",
  "Demand Gen": "Demand Gen",
  "In-stream video": "Video (in-stream)",
  "Smart": "Inteligentná"
};

/* Farby grafov */
SP.FARBY = {
  primar: () => getComputedStyle(document.documentElement).getPropertyValue("--primar").trim() || "#009137",
  limetka: "#AAC805",
  oranz: "#F08203",
  porovnanie: () => getComputedStyle(document.documentElement).getPropertyValue("--text-slaby").trim() || "#9CA5AE"
};
