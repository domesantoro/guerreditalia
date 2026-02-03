(function () {
  "use strict";

  // Assunzione standard browser: 96 CSS px per inch in print layout.
  // Serve solo per impostare @page size; non è perfetta ma è quella che Chrome usa di fatto.
  var PX_PER_INCH = 96;

  function pxToIn(px) {
    var v = Number(px) || 0;
    return (v / PX_PER_INCH);
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildPrintHTML(timelineOuterHTML, pageWpx, pageHpx) {
    var baseHref = document.baseURI;

    // pagina gigantesca (una sola) grande quanto la griglia
    var wIn = pxToIn(pageWpx);
    var hIn = pxToIn(pageHpx);

    // clamp minimo (evita size 0)
    if (wIn < 1) wIn = 1;
    if (hIn < 1) hIn = 1;

    return '<!doctype html>' +
      '<html lang="it">' +
      '<head>' +
        '<meta charset="utf-8"/>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
        '<base href="' + escapeAttr(baseHref) + '">' +
        '<title>Timeline Print</title>' +
        '<link rel="stylesheet" href="css/style.css"/>' +
        '<style>' +
          'html,body{margin:0 !important; padding:0 !important; background:#fff !important;}' +

          /* IMPORTANTISSIMO: forza dimensione pagina = dimensione griglia */
          '@page{margin:0; size:' + wIn + 'in ' + hIn + 'in;}' +

          /* forza canvas di layout a quelle dimensioni (così non taglia) */
          'html,body{width:' + pageWpx + 'px !important; height:' + pageHpx + 'px !important;}' +
          'body{overflow:visible !important;}' +

          /* niente topbar */
          '#topBar{display:none !important;}' +

          /* niente scroll/sticky */
          '#timeline{height:auto !important; overflow:visible !important; background:#fff !important;}' +
          '#yearsRow{position:static !important; top:auto !important; box-shadow:none !important;}' +
          '.cornerCell,.nationLabel{position:static !important; left:auto !important;}' +

          /* forza larghezze a contenuto */
          '#yearsRow,#rows{width:' + pageWpx + 'px !important; min-width:0 !important;}' +

          /* stampa colori */
          '*{-webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;}' +

          /* se esiste tooltip */
          '#appTooltip{display:none !important;}' +
        '</style>' +
      '</head>' +
      '<body>' +
        timelineOuterHTML +
        '<script>' +
          'window.onload=function(){' +
            'requestAnimationFrame(function(){setTimeout(function(){window.print();},80);});' +
          '};' +
        '<\/script>' +
      '</body>' +
      '</html>';
  }

  function cleanupIframe(iframe) {
    try {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch (e) {}
  }

  function measureFullGrid() {
    var yearsRow = document.getElementById("yearsRow");
    var rows = document.getElementById("rows");

    if (!yearsRow || !rows) return { w: 0, h: 0 };

    // larghezza massima tra header anni e righe
    var w = Math.max(yearsRow.scrollWidth, rows.scrollWidth);

    // altezza totale = header + righe
    var h = yearsRow.scrollHeight + rows.scrollHeight;

    // arrotonda e aggiungi un filo per sicurezza (bordi)
    w = Math.ceil(w + 2);
    h = Math.ceil(h + 2);

    return { w: w, h: h };
  }

  function printTimelineToPDF() {
    var timeline = document.getElementById("timeline");
    if (!timeline) return;

    var m = measureFullGrid();
    if (!m.w || !m.h) return;

    // clona TUTTO ciò che già è renderizzato (anni + tutte le righe/colonne)
    var html = buildPrintHTML(timeline.outerHTML, m.w, m.h);

    var iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");

    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    // cleanup quando torni focus dopo dialog stampa
    var onFocus = function () {
      window.removeEventListener("focus", onFocus);
      cleanupIframe(iframe);
    };
    window.addEventListener("focus", onFocus);

    // fallback cleanup
    setTimeout(function () {
      window.removeEventListener("focus", onFocus);
      cleanupIframe(iframe);
    }, 8000);
  }

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      var btn = t.closest ? t.closest("#printPdfBtn") : null;
      if (!btn) return;
      printTimelineToPDF();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

})();
