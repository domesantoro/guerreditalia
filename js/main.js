let CELL_WIDTH = 200;

$(function () {

  if (typeof DATA === "undefined" || !DATA || !DATA.nations) {
    console.error("DATA non è definito. Ordine script: data.js prima di main.js");
    return;
  }

  const sliderInit = parseInt($("#zoomSlider").val(), 10);
  if (!Number.isNaN(sliderInit)) CELL_WIDTH = sliderInit;

  syncTopBarHeight();
  $(window).on("resize", syncTopBarHeight);

  applyZoom(CELL_WIDTH);
  buildTimeline();
  buildFilters();
  wireZoom();

  // Tooltip custom (NO jQuery UI tooltip)
  wireCustomTooltip();

  // Export: Pure SVG + PNG/PDF da Pure SVG (NO foreignObject)
  wireExportPure();
});

function syncTopBarHeight() {
  const h = $("#topBar").outerHeight() || 56;
  document.documentElement.style.setProperty("--topBarH", h + "px");
}

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, "").trim();
}

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNationFlag(nationKey) {
  const n = DATA.nations[nationKey];
  if (!n || !n.flag || !n.flag.file) return "";
  return `<img class="nationFlag" src="${n.flag.file}" alt="${escapeHtml(n.name)}">`;
}

/* FILTER UI */
function buildFilters() {
  const box = $("#filters").empty();

  for (let k in DATA.nations) {
    const n = DATA.nations[k];
    const el = $(`
      <label class="filterItem">
        <input type="checkbox" checked data-nation="${k}">
        ${escapeHtml(n.name)}
      </label>
    `);
    box.append(el);
  }

  $("#filters input[type='checkbox']").on("change", function () {
    const id = $(this).data("nation");
    $(`.nationRow[data-nation="${id}"]`).toggle(this.checked);
    syncTopBarHeight();
  });

  syncTopBarHeight();
}

/* TIMELINE BUILD */
function buildTimeline() {
  $("#yearsRow").empty();
  $("#rows").empty();

  const years = collectYearsContinuous();

  $("#yearsRow").append(`<div class="cornerCell">Nazioni</div>`);
  $("#yearsRow").append(`<div class="yearCell yearIntro">Intro</div>`);
  years.forEach(y => $("#yearsRow").append(`<div class="yearCell">${y}</div>`));

  for (let key in DATA.nations) {
    const nation = DATA.nations[key];
    const row = $(`<div class="nationRow" data-nation="${key}"></div>`);

    const captionHtml = nation.caption ? `<div class="nationCaption">${escapeHtml(nation.caption)}</div>` : "";

    const label = $(
      `<div class="nationLabel">
        ${renderNationFlag(key)}
        <div class="nationText">
          <div class="nationName">${escapeHtml(nation.name)}</div>
          ${captionHtml}
        </div>
      </div>`
    );

    const cells = $(`<div class="cells"></div>`);
    const { map, introBlock } = mapCrono(nation.crono);

    const introCell = $(`<div class="cell introCell"></div>`);
    if (introBlock) introBlock.events.forEach(ev => introCell.append(renderEvent(ev)));
    cells.append(introCell);

    for (let i = 0; i < years.length; i++) {
      const y = years[i];

      if (map[y] && map[y].span) {
        const span = map[y].span;
        const spanCell = $(`<div class="cell spanCell"></div>`);
        spanCell.attr("data-span", span);
        spanCell.css("background", rgba(nation.color, 0.56));
        spanCell.css({
          width: (CELL_WIDTH * span) + "px",
          minWidth: (CELL_WIDTH * span) + "px"
        });
        map[y].events.forEach(ev => spanCell.append(renderEvent(ev)));
        cells.append(spanCell);
        i += (span - 1);
        continue;
      }

      if (map[y]) {
        const c = $(`<div class="cell"></div>`);
        c.css("background", rgba(nation.color, 0.56));
        map[y].events.forEach(ev => c.append(renderEvent(ev)));
        cells.append(c);
      } else {
        cells.append(`<div class="cell"></div>`);
      }
    }

    row.append(label).append(cells);
    $("#rows").append(row);
  }

  $("#rows").sortable({
    axis: "y",
    containment: "parent",
    tolerance: "pointer"
  });

  refreshSpanWidths();
}

function collectYearsContinuous() {
  let minY = null;
  let maxY = null;

  Object.values(DATA.nations).forEach(n => {
    (n.crono || []).forEach(c => {
      if (c.year === null) return;
      const base = c.year;
      if (minY === null || base < minY) minY = base;
      const end = c.span ? (base + c.span - 1) : base;
      if (maxY === null || end > maxY) maxY = end;
    });
  });

  if (minY === null || maxY === null) return [];

  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  return years;
}

function mapCrono(crono) {
  let map = {};
  let introBlock = null;

  for (let i = 0; i < crono.length; i++) {
    const c = crono[i];
    if (c.year === null) {
      if (!introBlock) introBlock = c;
      continue;
    }
    map[c.year] = c;
  }
  return { map, introBlock };
}

function refreshSpanWidths() {
  $(".spanCell").each(function () {
    const span = parseInt($(this).attr("data-span"), 10);
    if (!span || span < 2) return;
    $(this).css({
      width: (CELL_WIDTH * span) + "px",
      minWidth: (CELL_WIDTH * span) + "px"
    });
  });
}

/* EVENTS */
function renderEvent(ev) {
  const box = $(`<div class="event"></div>`);

  if (ev.icon) {
    const img = $("<img>");

    if (ev.icon.file) {
      img.attr("src", ev.icon.file).css("width", "32px");
      img.attr("alt", "");
    } else if (ev.icon.nation) {
      const n = DATA.nations[ev.icon.nation];
      if (n && n.flag) {
        const h = 32;
        const w = Math.round(h / n.flag.ratio);
        img.attr("src", n.flag.file).css({ height: h + "px", width: w + "px" });
        img.attr("alt", "");
      }
    }
    if (img.attr("src")) box.append(img);
  }

  box.append(`<div class="eventText">${ev.text}</div>`);

  // tooltip text (solo testo, niente HTML)
  box.attr("data-tooltip", stripHtml(ev.text));
  return box;
}

/* ZOOM */
function wireZoom() {
  $("#zoomSlider").on("input", function () {
    CELL_WIDTH = parseInt(this.value, 10);
    applyZoom(CELL_WIDTH);
    refreshSpanWidths();
  });
}

function applyZoom(w) {
  document.documentElement.style.setProperty("--cellWidth", w + "px");
}

/* TOOLTIP CUSTOM (NO injected elements) */
function wireCustomTooltip() {
  const tip = $("#appTooltip");
  const pad = 14;

  let visible = false;

  function hide() {
    visible = false;
    tip.removeClass("show");
    tip.css({ left: "-9999px", top: "-9999px" });
  }

  function show(text) {
    if (!text) return;
    tip.text(text);
    tip.addClass("show");
    visible = true;
  }

  function move(e) {
    if (!visible) return;

    // posiziona senza uscire dallo schermo
    const tw = tip.outerWidth();
    const th = tip.outerHeight();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = e.clientX + pad;
    let y = e.clientY + pad;

    if (x + tw + 6 > vw) x = Math.max(6, e.clientX - tw - pad);
    if (y + th + 6 > vh) y = Math.max(6, e.clientY - th - pad);

    tip.css({ left: x + "px", top: y + "px" });
  }

  // Delegation
  $(document).on("mouseenter", ".event", function (e) {
    const t = $(this).attr("data-tooltip") || "";
    show(t);
    move(e);
  });

  $(document).on("mousemove", ".event", function (e) {
    move(e);
  });

  $(document).on("mouseleave", ".event", function () {
    hide();
  });

  // se scrolli il container, nascondi (evita tooltip “perso”)
  $("#timeline").on("scroll", hide);
}

/* EXPORT PURE SVG + PNG/PDF */
function wireExportPure() {
  $("#exportSvgBtn").on("click", async function () {
    const svgText = await buildPureSVG();
    if (!svgText) return;
    downloadText("timeline.svg", svgText, "image/svg+xml;charset=utf-8");
  });

  $("#exportPngBtn").on("click", async function () {
    const svgText = await buildPureSVG();
    if (!svgText) return;
    const dataUrl = await rasterizeSVGToPNG(svgText, 3);
    if (!dataUrl) return;
    downloadDataUrl("timeline.png", dataUrl);
  });

  $("#exportPdfBtn").on("click", async function () {
    const svgText = await buildPureSVG();
    if (!svgText) return;
    const dataUrl = await rasterizeSVGToPNG(svgText, 3);
    if (!dataUrl) return;
    openPrintWindowForPDF(dataUrl);
  });
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Costruisce un SVG “puro” leggendo le geometrie reali dal DOM:
 * - rettangoli di cella e row background
 * - cards (event) come rettangoli con testo
 * - immagini come <image href="data:...">
 *
 * ZERO foreignObject = ZERO comportamento “random” di Chrome.
 */
async function buildPureSVG() {
  try {
    const timeline = document.getElementById("timeline");
    const yearsRow = document.getElementById("yearsRow");
    const rows = document.getElementById("rows");

    // dimensioni effettive
    const w = Math.max(yearsRow.scrollWidth, rows.scrollWidth);
    const h = yearsRow.scrollHeight + rows.scrollHeight;

    // mapping immagini DOM -> dataURL (solo immagini che già esistono e sono caricabili)
    const imgMap = buildImageDataUrlMapFromDOM();

    // helper: trasformare DOM rect in coordinate relative al timeline
    const tRect = timeline.getBoundingClientRect();
    const offsetX = tRect.left;
    const offsetY = tRect.top;

    // colori base
    const bg = "#f4f5f7";
    const borderLight = "#e6e8ec";
    const borderRowTop = "#000000";

    let parts = [];
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
    parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`);

    // HEADER (yearsRow)
    {
      const yRect = yearsRow.getBoundingClientRect();
      const y0 = Math.round(yRect.top - offsetY);
      const h0 = Math.round(yRect.height);

      // fondo header
      parts.push(`<rect x="0" y="${y0}" width="${w}" height="${h0}" fill="#ffffff" stroke="${borderLight}" stroke-width="1"/>`);

      // corner + years
      const cells = yearsRow.querySelectorAll(".cornerCell, .yearCell");
      cells.forEach(cell => {
        const r = cell.getBoundingClientRect();
        const x = Math.round(r.left - offsetX);
        const y = Math.round(r.top - offsetY);
        const cw = Math.round(r.width);
        const ch = Math.round(r.height);

        // background alternati in base a classe
        let fill = "#ffffff";
        if (cell.classList.contains("cornerCell")) fill = "#f0f1f3";
        if (cell.classList.contains("yearIntro")) fill = "#f0f1f3";

        parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${fill}" stroke="${borderLight}" stroke-width="1"/>`);

        const text = cell.textContent.trim();
        if (text) {
          const tx = x + cw/2;
          const ty = y + ch/2 + 6;
          const fw = cell.classList.contains("cornerCell") ? "800" : "800";
          parts.push(`<text x="${tx}" y="${ty}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="${fw}" fill="#111">${escapeXml(text)}</text>`);
        }
      });
    }

    // ROWS
    const rowEls = Array.from(rows.querySelectorAll(".nationRow")).filter(r => r.offsetParent !== null); // visibili
    rowEls.forEach(row => {
      const rRow = row.getBoundingClientRect();
      const x0 = Math.round(rRow.left - offsetX);
      const y0 = Math.round(rRow.top - offsetY);
      const rw = Math.round(rRow.width);
      const rh = Math.round(rRow.height);

      // border-top nero
      parts.push(`<line x1="${x0}" y1="${y0}" x2="${x0+rw}" y2="${y0}" stroke="${borderRowTop}" stroke-width="1"/>`);

      // label cell
      const label = row.querySelector(".nationLabel");
      if (label) {
        const r = label.getBoundingClientRect();
        const x = Math.round(r.left - offsetX);
        const y = Math.round(r.top - offsetY);
        const cw = Math.round(r.width);
        const ch = Math.round(r.height);

        parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#f7f8fa" stroke="${borderLight}" stroke-width="1"/>`);

        // bandiera nazione
        const flag = label.querySelector("img.nationFlag");
        if (flag) {
          const fr = flag.getBoundingClientRect();
          const fx = Math.round(fr.left - offsetX);
          const fy = Math.round(fr.top - offsetY);
          const fw = Math.round(fr.width);
          const fh = Math.round(fr.height);

          const src = flag.currentSrc || flag.src;
          const abs = absolutizeUrl(src);
          const dataUrl = imgMap.get(abs);
          if (dataUrl) {
            parts.push(`<image x="${fx}" y="${fy}" width="${fw}" height="${fh}" href="${dataUrl}"/>`);
          }
        }

        // nome/caption
        const nameEl = label.querySelector(".nationName");
        const capEl = label.querySelector(".nationCaption");
        if (nameEl) {
          const nr = nameEl.getBoundingClientRect();
          const nx = Math.round(nr.left - offsetX);
          const ny = Math.round(nr.top - offsetY);
          parts.push(`<text x="${nx}" y="${ny+18}" text-anchor="start" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#111">${escapeXml(nameEl.textContent.trim())}</text>`);
        }
        if (capEl) {
          const cr = capEl.getBoundingClientRect();
          const cx = Math.round(cr.left - offsetX);
          const cy = Math.round(cr.top - offsetY);
          parts.push(`<text x="${cx}" y="${cy+14}" text-anchor="start" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#545b66">${escapeXml(capEl.textContent.trim())}</text>`);
        }
      }

      // cell grid (solo rettangoli: sfondi + griglia)
      const cells = Array.from(row.querySelectorAll(".cell"));
      cells.forEach(cell => {
        const r = cell.getBoundingClientRect();
        const x = Math.round(r.left - offsetX);
        const y = Math.round(r.top - offsetY);
        const cw = Math.round(r.width);
        const ch = Math.round(r.height);

        // background dal computed style (già contiene l'rgba o trasparente)
        const cs = getComputedStyle(cell);
        const fill = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : "transparent";

        parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${fill}" stroke="${borderLight}" stroke-width="1"/>`);
      });

      // eventi
      const evs = Array.from(row.querySelectorAll(".event"));
      evs.forEach(ev => {
        const er = ev.getBoundingClientRect();
        const ex = Math.round(er.left - offsetX);
        const ey = Math.round(er.top - offsetY);
        const ew = Math.round(er.width);
        const eh = Math.round(er.height);

        // card rect
        parts.push(`<rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="12" ry="12" fill="#ffffff" stroke="#e3e6ec" stroke-width="1"/>`);

        // icona se presente
        const im = ev.querySelector("img");
        let textStartX = ex + 12;
        if (im) {
          const ir = im.getBoundingClientRect();
          const ix = Math.round(ir.left - offsetX);
          const iy = Math.round(ir.top - offsetY);
          const iw = Math.round(ir.width);
          const ih = Math.round(ir.height);

          const src = im.currentSrc || im.src;
          const abs = absolutizeUrl(src);
          const dataUrl = imgMap.get(abs);
          if (dataUrl) {
            parts.push(`<image x="${ix}" y="${iy}" width="${iw}" height="${ih}" href="${dataUrl}"/>`);
          }
          textStartX = Math.max(textStartX, ix + iw + 10);
        }

        // testo (una riga, ellissi se lungo: qui facciamo taglio semplice)
        const text = (ev.getAttribute("data-tooltip") || "").trim();
        if (text) {
          const maxChars = Math.max(12, Math.floor((ew - (textStartX - ex) - 14) / 7));
          const shown = text.length > maxChars ? (text.slice(0, maxChars-1) + "…") : text;

          const ty = ey + Math.min(eh - 10, 26);
          parts.push(`<text x="${textStartX}" y="${ty}" text-anchor="start" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#111">${escapeXml(shown)}</text>`);
        }
      });
    });

    parts.push(`</svg>`);
    return parts.join("\n");
  } catch (e) {
    console.error("buildPureSVG error", e);
    return null;
  }
}

/* ---- Immagini DOM -> dataURL (senza fetch) ---- */
function buildImageDataUrlMapFromDOM() {
  const imgs = Array.from(document.querySelectorAll("#timeline img"));
  const map = new Map();

  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src) continue;
    const abs = absolutizeUrl(src);

    if (map.has(abs)) continue;

    const dataUrl = safeImageToDataURL(img);
    if (dataUrl) map.set(abs, dataUrl);
  }
  return map;
}

function safeImageToDataURL(imgEl) {
  try {
    if (!imgEl.complete || imgEl.naturalWidth === 0 || imgEl.naturalHeight === 0) return null;
    const c = document.createElement("canvas");
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(imgEl, 0, 0);
    return c.toDataURL("image/png");
  } catch (e) {
    // se questa esplode, quell’immagine non la includiamo, ma NON taintiamo il resto perché non la mettiamo nell'SVG
    return null;
  }
}

function absolutizeUrl(u) {
  try {
    return new URL(u, document.baseURI).href;
  } catch (e) {
    return u;
  }
}

/* ---- Raster pure SVG -> PNG ---- */
async function rasterizeSVGToPNG(svgText, scale) {
  const svg64 = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);

  let img;
  try {
    img = await loadImage(svg64);
  } catch (e) {
    console.error("Impossibile caricare SVG dataURL per raster", e);
    return null;
  }

  const width = Math.max(1, img.naturalWidth || img.width);
  const height = Math.max(1, img.naturalHeight || img.height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(img, 0, 0);

  try {
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("Canvas tainted (non dovrebbe più succedere con pure-SVG).", e);
    return null;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/* PDF: apre finestra con PNG e stampa -> Salva come PDF */
function openPrintWindowForPDF(pngDataUrl) {
  const win = window.open();
  if (!win) return;

  win.document.write(`
    <html>
      <head><title>timeline.pdf</title></head>
      <body style="margin:0">
        <img src="${pngDataUrl}" style="width:100%;height:auto;display:block"/>
        <script>
          window.onload = () => setTimeout(() => window.print(), 200);
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
