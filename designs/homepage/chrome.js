/* Header and footer shared by the inner pages. Load before search.js so the header search gets wired.
   The current page comes from <body data-page="…">. */
(function () {
  const page = document.body.dataset.page;
  const nav = [
    ["kandidati", "Kandidáti", "kandidati.html"],
    ["metodika", "Metodika", "metodika.html"],
    ["zdroje", "Zdroje", "zdroje.html"],
    ["opravy", "Opravy", "opravy.html"],
  ];
  const header = document.createElement("header");
  header.className = "bar glass";
  header.innerHTML =
    '<a class="brand" href="uvod.html"><i aria-hidden="true"></i>Koho volím</a>' +
    '<nav aria-label="Hlavná navigácia">' +
    nav.map(([id, label, href]) => '<a href="' + href + '"' + (id === page ? ' aria-current="page"' : "") + ">" + label + "</a>").join("") +
    "</nav>" +
    '<form class="kv-search hsearch" data-search data-group data-limit="8" data-base="" role="search" autocomplete="off">' +
    '<div class="line"><span class="arrow" aria-hidden="true">→</span>' +
    '<label for="hq" class="vh">Hľadať kandidáta, obec alebo voľbu</label>' +
    '<input id="hq" type="search" placeholder="Kandidát alebo obec"><kbd aria-hidden="true">/</kbd></div>' +
    '<ul data-results></ul><p data-status role="status" aria-live="polite"></p></form>' +
    '<div class="seg" aria-label="Jazyk"><a href="#" aria-current="true">SK</a><a href="#">HU</a><a href="#">EN</a></div>';
  const root = document.querySelector(".page");
  root.prepend(header);

  const footer = document.createElement("footer");
  footer.className = "site";
  footer.innerHTML =
    "<span>Kandidáti: MV SR, stav k 23. 10. 2026 · Hranice: geoBoundaries (CC BY 4.0) · Názvy obcí: Wikidata</span>" +
    '<span><a href="metodika.html">Metodika</a> · <a href="zdroje.html">Zdroje</a> · <a href="opravy.html">Nahlásiť chybu</a></span>';
  root.append(footer);

  const sky = document.createElement("div");
  sky.className = "sky"; sky.setAttribute("aria-hidden", "true");
  sky.innerHTML = '<div class="halo"></div><div class="grain"></div>';
  document.body.prepend(sky);
})();
