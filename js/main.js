/* main.js assume che DATA sia già definito (caricato via js/data.js) */

let CELL_WIDTH = 200;

$(function () {

  if (typeof DATA === "undefined" || !DATA || !DATA.nations) {
    console.error("DATA non è definito. Ordine script: data.js prima di main.js");
    return;
  }

  // leggi CELL_WIDTH dallo slider (evita mismatch iniziali)
  const sliderInit = parseInt($("#zoomSlider").val(), 10);
  if (!Number.isNaN(sliderInit)) CELL_WIDTH = sliderInit;

  syncTopBarHeight();
  $(window).on("resize", syncTopBarHeight);

  applyZoom(CELL_WIDTH);
  buildTimeline();
  buildFilters();
  enableTooltips();
  wireZoom();
  wireExport();
});

function syncTopBarHeight() {
  const h = $("#topBar").outerHeight() || 56;
  document.documentElement.style.setProperty("--topBarH", h + "px");
}

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, "");
}

function renderNationFlag(nationKey) {
  const n = DATA.nations[nationKey];
  if (!n || !n.flag || !n.flag.file) return "";
  return `<img class="nationFlag" src="${n.flag.file}" alt="${n.name}">`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ==========================
   FILTER UI
========================== */

function buildFilters() {
  const box = $("#filters").empty();

  for (let k in DATA.nations) {
    const n = DATA.nations[k];

    const el = $(`
      <label class="filterItem">
        <input type="checkbox" checked data-nation="${k}">
        ${n.name}
      </label>
    `);

    box.append(el);
  }

  $("#filters input[type='checkbox']").on("change", function () {
    const id = $(this).data("nation");
    $(`.nationRow[data-nation="${id}"]`).toggle(this.checked);
    syncTopBarHeight(); // topbar può cambiare altezza se wrappa
  });

  syncTopBarHeight();
}

/* ==========================
   TIMELINE BUILD
========================== */

function buildTimeline() {

  $("#yearsRow").empty();
  $("#rows").empty();

  const years = collectYearsContinuous();

  // Header: colonna nazioni + intro + anni
  $("#yearsRow").append(`<div class="cornerCell">Nazioni</div>`);
  $("#yearsRow").append(`<div class="yearCell yearIntro">Intro</div>`);
  years.forEach(y => $("#yearsRow").append(`<div class="yearCell">${y}</div>`));

  // Rows
  for (let key in DATA.nations) {

    const nation = DATA.nations[key];

    const row = $(`<div class="nationRow" data-nation="${key}"></div>`);

    const captionHtml = nation.caption ? `<div class="nationCaption">${escapeHtml(nation.caption)}</div>` : "";

    const label = $(
      `<div class="nationLabel">
        ${renderNationFlag(key)}
        <div class="nationText">
          <div class="nationName">${nation.name}</div>
          ${captionHtml}
        </div>
      </div>`
    );

    const cells = $(`<div class="cells"></div>`);

    const { map, introBlock } = mapCrono(nation.crono);

    // Intro cell (sempre grigio)
    const introCell = $(`<div class="cell introCell"></div>`);
    if (introBlock) introBlock.events.forEach(ev => introCell.append(renderEvent(ev)));
    cells.append(introCell);

    // Years cells
    for (let i = 0; i < years.length; i++) {

      const y = years[i];

      // SPAN come UNICA CELLA larga N colonne (simula colspan)
      if (map[y] && map[y].span) {

        const span = map[y].span;

        const spanCell = $(`<div class="cell spanCell"></div>`);
        spanCell.attr("data-span", span);
        spanCell.css("background", rgba(nation.color, 0.56));

        // larghezza = span * cellWidth
        spanCell.css({
          width: (CELL_WIDTH * span) + "px",
          minWidth: (CELL_WIDTH * span) + "px"
        });

        map[y].events.forEach(ev => spanCell.append(renderEvent(ev)));
        cells.append(spanCell);

        // salta le successive (span-1) colonne coperte
        i += (span - 1);
        continue;
      }

      // Year with events: tinta
      if (map[y]) {
        const c = $(`<div class="cell"></div>`);
        c.css("background", rgba(nation.color, 0.56));
        map[y].events.forEach(ev => c.append(renderEvent(ev)));
        cells.append(c);
      } else {
        // Empty year: trasparente
        cells.append(`<div class="cell"></div>`);
      }
    }

    row.append(label).append(cells);
    $("#rows").append(row);
  }

  // Drag reorder nations
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

  // trova min/max considerando anche gli span
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

/* ==========================
   EVENTS
========================== */

function renderEvent(ev) {

  const box = $(`<div class="event"></div>`);

  if (ev.icon) {
    const img = $("<img>");

    if (ev.icon.file) {
      img.attr("src", ev.icon.file).css("width", "32px");
    } else if (ev.icon.nation) {
      const n = DATA.nations[ev.icon.nation];
      if (n && n.flag) {
        const h = 32;
        const w = Math.round(h / n.flag.ratio);
        img.attr("src", n.flag.file).css({ height: h + "px", width: w + "px" });
      }
    }

    if (img.attr("src")) box.append(img);
  }

  box.append(`<div class="eventText">${ev.text}</div>`);

  // Tooltip: niente title, uso data-tooltip
  const tooltipText = stripHtml(ev.text);
  box.attr("data-tooltip", tooltipText);
  box.removeAttr("title");

  return box;
}

/* ==========================
   TOOLTIP (jQuery UI)
========================== */

function enableTooltips() {
  $(document).tooltip({
    items: ".event",
    track: true,
    content: function () {
      return $(this).attr("data-tooltip") || "";
    },
    position: {
      my: "left top+12",
      at: "left bottom",
      collision: "flipfit"
    }
  });
}

/* ==========================
   ZOOM
========================== */

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

/* ==========================
   EXPORT SVG (XHTML well-formed)
========================== */

function wireExport() {
  $("#exportBtn").on("click", function () {
    exportTimelineAsStandaloneSVG();
  });
}

function exportTimelineAsStandaloneSVG() {

  const timelineEl = document.querySelector("#timeline");
  const yearsRowEl = document.querySelector("#yearsRow");
  const rowsEl = document.querySelector("#rows");

  const contentWidth = Math.max(yearsRowEl.scrollWidth, rowsEl.scrollWidth);
  const contentHeight = yearsRowEl.scrollHeight + rowsEl.scrollHeight;

  // clone "pulito" (niente sticky per export)
  const clone = timelineEl.cloneNode(true);

  // rimuovi overflow/height e sticky per evitare layout strano in SVG
  clone.style.overflow = "visible";
  clone.style.height = "auto";
  clone.style.background = "#f4f5f7";

  // sticky -> static nel clone
  clone.querySelectorAll("#yearsRow, .cornerCell, .nationLabel").forEach(el => {
    el.style.position = "static";
    el.style.left = "auto";
    el.style.top = "auto";
    el.style.zIndex = "auto";
    el.style.boxShadow = "none";
  });

  // forza larghezze span nel clone
  clone.querySelectorAll(".spanCell").forEach(el => {
    const span = parseInt(el.getAttribute("data-span"), 10);
    if (span && span > 1) {
      el.style.width = (CELL_WIDTH * span) + "px";
      el.style.minWidth = (CELL_WIDTH * span) + "px";
    }
  });

  // CSS incorporato
  const cssText = collectSameOriginCSS();

  const rootStyle =
`:root{
  --cellWidth:${CELL_WIDTH}px;
  --nationColW:${getComputedStyle(document.documentElement).getPropertyValue("--nationColW") || "220px"};
  --topBarH:56px;
}
`;

  // XHTML string (well-formed)
  let bodyHtml = clone.innerHTML;

  // 1) self-close void tags (img è quello che ti rompe l’XML)
  bodyHtml = selfCloseVoidTags(bodyHtml);

  // 2) escape ampersand “nudi” (evita XML break)
  bodyHtml = escapeBareAmpersands(bodyHtml);

  // stesso per CSS (di solito non serve, ma safe)
  const cssSafe = escapeBareAmpersands(selfCloseVoidTags(cssText));

  const xhtml =
`<div xmlns="http://www.w3.org/1999/xhtml">
  <style>${rootStyle}\n${cssSafe}</style>
  ${bodyHtml}
</div>`;

  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${contentWidth}" height="${contentHeight}">
  <foreignObject width="100%" height="100%">
    ${xhtml}
  </foreignObject>
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "timeline.svg";
  a.click();

  URL.revokeObjectURL(url);
}

function collectSameOriginCSS() {
  let out = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const r of Array.from(rules)) out += r.cssText + "\n";
    } catch (e) {
      // ignora cross-origin
    }
  }
  return out;
}

function selfCloseVoidTags(html) {
  // chiude i void tags in stile XHTML
  return html
    .replace(/<img([^>]*)>/gi, "<img$1 />")
    .replace(/<br([^>]*)>/gi, "<br$1 />")
    .replace(/<hr([^>]*)>/gi, "<hr$1 />")
    .replace(/<input([^>]*)>/gi, "<input$1 />")
    .replace(/<meta([^>]*)>/gi, "<meta$1 />")
    .replace(/<link([^>]*)>/gi, "<link$1 />");
}

function escapeBareAmpersands(s) {
  // converte & non già parte di un'entità in &amp;
  return s.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
}
