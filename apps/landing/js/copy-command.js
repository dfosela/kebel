(function () {
  "use strict";
  const btn = document.getElementById("copyCmd");
  const code = document.getElementById("cmdText");
  if (!btn || !code) return;
  btn.addEventListener("click", () => {
    const text = code.textContent.replace(/^\s*\$\s*/, "");
    const done = () => { btn.textContent = "copiado"; setTimeout(() => { btn.textContent = "copiar"; }, 1600); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  });
})();
