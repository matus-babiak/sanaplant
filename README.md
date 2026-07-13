# Sanaplant · interaktívny reporting

Online reportingová aplikácia pre klienta Sanaplant. Číta mesačné CSV exporty
z Google Ads a Meta Ads priamo zo zložky `Dáta` a zobrazuje ich ako interaktívny
dashboard s časovým filtrom, porovnaniami a komentármi.

## Ako pridať nový mesiac

1. Stiahni mesačný export (CSV) z Google Ads / Meta Ads — rovnaký formát ako doteraz.
2. Ulož ho do `Dáta/<rok>/<Platforma>/`, napr. `Dáta/2026/Meta/...csv`.
3. Aktualizuj zoznam súborov:
   ```
   node scripts/generuj-manifest.mjs
   ```
   Po nahratí na GitHub sa manifest generuje automaticky (GitHub Action),
   takže stačí commitnúť CSV a pushnúť.

## Spustenie lokálne

Aplikácia potrebuje ľubovoľný statický server (kvôli načítavaniu CSV):

```
python -m http.server 8137
```

a otvor `http://localhost:8137`.

## Nasadenie na GitHub Pages

1. Vytvor GitHub repozitár a pushni celý tento priečinok.
2. V repozitári: **Settings → Pages → Source: Deploy from a branch → main / root**.
3. Aplikácia bude bežať na `https://<užívateľ>.github.io/<repo>/`.
4. Pri každom pushnutí nového CSV sa manifest aktualizuje automaticky.

## Heslo

Prístup chráni jednoduché heslo (aktuálne `SanaPlant123`). Zmena hesla:

1. Otvor aplikáciu v prehliadači, stlač **F12** (konzola).
2. Napíš `await spHash("NoveHeslo")` a skopíruj výsledný kód.
3. Vlož ho do `assets/js/config.js` do `SP.HESLO_HASH`.

> Pozn.: ide o jednoduchú ochranu na úrovni prehliadača — pre bežné zdieľanie
> reportov klientovi postačuje, nie je to však plnohodnotné zabezpečenie servera.

## Komentáre k mesiacom

Komentár k výsledkom sa **generuje automaticky z dát** — zhrnie investíciu, obrat,
návratnosť, porovnanie s predošlým obdobím a najlepšie kampane/reklamy.

Voliteľne možno do súboru `komentare.json` doplniť vlastnú poznámku správcu
(2–3 vety), ktorá sa zobrazí pod automatickým zhrnutím:

```json
{
  "2026-06": {
    "prehlad": "Celkovo najsilnejší mesiac sezóny...",
    "google": "PMax kampane sme obmedzili kvôli...",
    "meta": "Najlepšie fungovala kampaň na žltnutie viniča..."
  }
}
```

Kľúče: `prehlad` (stránka Prehľad), `google` (Google Ads), `meta` (Meta Ads).
Prázdne texty sa nezobrazujú.

## Interpretácia dát (dohodnuté pravidlá)

- **Google konverzie** sa mapujú na 3 hlavné: všetko s `purchase` → Nákupy,
  `add_to_cart` → Košík, `begin_checkout` → Pokladňa. Akcie
  `obchod_kategoria_produkt`, `25s_view` a `view_item` sa nepočítajú.
- **Hodnota konverzií a ROAS** sa počítajú len z nákupov (purchase).
- Google exporty sú segmentované podľa konverznej akcie, preto sú investícia,
  impresie a kliknutia dostupné len za účet a typ kampane (nie per kampaň).
- Meta: video metriky a rozpočty sa nezobrazujú (dohodnuté).
