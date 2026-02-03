/* main.js assume che DATA sia già definito (caricato via js/data.js) */

let CELL_WIDTH = 200;

$(function () {

  if (typeof DATA === "undefined" || !DATA || !DATA.nations) {
    console.error("DATA non è definito. Ordine script: data.js prima di main.js");
    return;
  }

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
  });
}

/* ==========================
   TIMELINE BUILD
========================== */

function buildTimeline() {

  $("#yearsRow").empty();
  $("#rows").empty();

  const years = collectYears();

  // Header: colonna nazioni + intro + anni
  $("#yearsRow").append(`<div class="cornerCell">Nazioni</div>`);
  $("#yearsRow").append(`<div class="yearCell yearIntro">Intro</div>`);
  years.forEach(y => $("#yearsRow").append(`<div class="yearCell">${y}</div>`));

  // Rows
  for (let key in DATA.nations) {

    const nation = DATA.nations[key];

    const row = $(`<div class="nationRow" data-nation="${key}"></div>`);

    const label = $(
      `<div class="nationLabel">
        ${renderNationFlag(key)}
        <span>${nation.name}</span>
      </div>`
    );

    const cells = $(`<div class="cells"></div>`);

    const { map, introBlock } = mapCrono(nation.crono);

    // Intro cell: sempre grigio tenue (non tinto con colore nazione)
    const introCell = $(`<div class="cell introCell"></div>`);
    if (introBlock) introBlock.events.forEach(ev => introCell.append(renderEvent(ev)));
    cells.append(introCell);

    // Years cells
    for (let i = 0; i < years.length; i++) {

      const y = years[i];

      // SPAN: un blocco largo N colonne (celle tinte), eventi nella prima
      if (map[y] && map[y].span) {

        const span = map[y].span;
        const wrap = $(`<div class="spanBlock"></div>`);

        for (let s = 0; s < span; s++) {
          const sc = $(`<div class="spanCell tinted"></div>`);
          sc.css("background", rgba(nation.color, 0.56)); // alpha 0.56

          if (s === 0) {
            map[y].events.forEach(ev => sc.append(renderEvent(ev)));
          }

          wrap.append(sc);
        }

        cells.append(wrap);
        i += (span - 1);
        continue;
      }

      // Year with events
      if (map[y]) {
        const c = $(`<div class="cell tinted"></div>`);
        c.css("background", rgba(nation.color, 0.56)); // alpha 0.56
        map[y].events.forEach(ev => c.append(renderEvent(ev)));
        cells.append(c);
      } else {
        // Empty year: transparent
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
}

function collectYears() {
  const yearsSet = new Set();

  Object.values(DATA.nations).forEach(n => {
    n.crono.forEach(c => {
      if (c.year !== null) yearsSet.add(c.year);
      if (c.span && c.year !== null) {
        for (let i = 1; i < c.span; i++) yearsSet.add(c.year + i);
      }
    });
  });

  return [...yearsSet].sort((a, b) => a - b);
}

function mapCrono(crono) {
  let map = {};
  let introBlock = null;

  for (let i = 0; i < crono.length; i++) {
    const c = crono[i];
    if (c.year === null) {
      if (!introBlock) introBlock = c; // tieni solo il primo null
      continue;
    }
    map[c.year] = c;
  }

  return { map, introBlock };
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
  box.attr("title", stripHtml(ev.text));

  return box;
}

/* ==========================
   TOOLTIP
========================== */

function enableTooltips() {
  $(document).tooltip({
    items: ".event",
    track: true
  });
}

/* ==========================
   ZOOM
========================== */

function wireZoom() {
  $("#zoomSlider").on("input", function () {
    CELL_WIDTH = parseInt(this.value, 10);
    applyZoom(CELL_WIDTH);
  });
}

function applyZoom(w) {
  document.documentElement.style.setProperty("--cellWidth", w + "px");
}

/* ==========================
   EXPORT SVG
========================== */

function wireExport() {
  $("#exportBtn").on("click", function () {

    const node = document.querySelector("#timeline");
    const serialized = new XMLSerializer().serializeToString(node);

    const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900">
  <foreignObject width="100%" height="100%">
    ${serialized}
  </foreignObject>
</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "timeline.svg";
    a.click();

    URL.revokeObjectURL(url);
  });
}
