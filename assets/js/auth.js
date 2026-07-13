/* ═══════════════════════════════════════════════════════════
   Sanaplant Reporting · jednoduchá ochrana heslom
   ═══════════════════════════════════════════════════════════ */
window.SP = window.SP || {};

/* Pomôcka na vygenerovanie hashu nového hesla — spustiť v konzole:
   await spHash("NoveHeslo") */
window.spHash = async function (text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
};

SP.auth = {
  jePrihlaseny: () => sessionStorage.getItem("sp-auth") === "1",

  async over(heslo) {
    if (!crypto.subtle) {
      alert("Aplikáciu treba otvoriť cez http(s) alebo localhost, nie priamo zo súboru.");
      return false;
    }
    const hash = await window.spHash(heslo);
    if (hash === SP.HESLO_HASH) {
      sessionStorage.setItem("sp-auth", "1");
      return true;
    }
    return false;
  },

  odhlas() {
    sessionStorage.removeItem("sp-auth");
    location.reload();
  }
};
