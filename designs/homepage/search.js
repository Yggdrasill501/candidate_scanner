/* Shared search mock for the Koho volím homepage designs.
   Suggests real municipalities, districts and region-wide races. No candidate
   data is bundled: candidates come from the database in the real build. */
(function () {
  // okres → number of municipalities (sum 354)
  const OKRESY = [
    ["Komárno", 41, 47.82, 18.0],
    ["Levice", 89, 48.15, 18.65],
    ["Nitra", 62, 48.3, 18.12],
    ["Nové Zámky", 62, 47.92, 18.4],
    ["Šaľa", 13, 48.1, 17.85],
    ["Topoľčany", 54, 48.58, 18.15],
    ["Zlaté Moravce", 33, 48.42, 18.42],
  ].map(([name, obce, lat, lon]) => ({ name, obce, lat, lon }));

  // [name, okres, lat, lon]; all 354 come from geo.js when a page loads it before this script
  const OBCE = (
    window.KVGEO
      ? window.KVGEO.obce.map((o) => [o.name, o.okres, o.c[1], o.c[0]])
      : [
          ["Nitra", "Nitra", 48.308, 18.087],
          ["Nové Zámky", "Nové Zámky", 47.986, 18.162],
          ["Komárno", "Komárno", 47.763, 18.128],
          ["Levice", "Levice", 48.217, 18.6],
          ["Topoľčany", "Topoľčany", 48.561, 18.177],
          ["Šaľa", "Šaľa", 48.151, 17.877],
          ["Zlaté Moravce", "Zlaté Moravce", 48.385, 18.4],
          ["Šurany", "Nové Zámky", 48.086, 18.186],
          ["Štúrovo", "Nové Zámky", 47.799, 18.718],
          ["Hurbanovo", "Komárno", 47.87, 18.196],
          ["Kolárovo", "Komárno", 47.916, 17.998],
          ["Nesvady", "Komárno", 47.93, 18.13],
          ["Želiezovce", "Levice", 48.05, 18.66],
          ["Tlmače", "Levice", 48.288, 18.531],
          ["Šahy", "Levice", 48.074, 18.949],
          ["Kalná nad Hronom", "Levice", 48.2, 18.52],
          ["Vráble", "Nitra", 48.244, 18.309],
          ["Mojmírovce", "Nitra", 48.21, 18.06],
          ["Jelšovce", "Nitra", 48.42, 18.16],
          ["Tvrdošovce", "Nové Zámky", 48.095, 18.059],
          ["Palárikovo", "Nové Zámky", 48.04, 18.065],
          ["Dvory nad Žitavou", "Nové Zámky", 47.99, 18.27],
          ["Vlčany", "Šaľa", 47.99, 17.95],
        ]
  ).map(([name, okres, lat, lon]) => ({
    kind: "obec",
    label: name,
    meta: "okres " + okres,
    okres,
    lat,
    lon,
  }));

  const VOLBY = [
    { kind: "voľba", label: "Predseda NSK", meta: "celý kraj · 1 mandát" },
    {
      kind: "voľba",
      label: "Poslanci zastupiteľstva NSK",
      meta: "podľa volebného obvodu",
    },
  ];

  const ITEMS = [
    ...OBCE,
    ...OKRESY.map((o) => ({
      kind: "okres",
      label: "Okres " + o.name,
      meta: o.obce + " obcí",
      okres: o.name,
      lat: o.lat,
      lon: o.lon,
    })),
    ...VOLBY,
    // example candidates, when a page loads sample.js
    ...(window.KVSAMPLE
      ? window.KVSAMPLE.people.map((p) => ({
          kind: "kandidát",
          label: p.name,
          meta: p.searchMeta,
          slug: p.slug,
          okres: p.okres,
        }))
      : []),
  ];
  const DEFAULTS = ["Nitra", "Nové Zámky", "Komárno", "Predseda NSK"].map((l) =>
    ITEMS.find((i) => i.label === l),
  );

  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = (s) =>
    s.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  function highlight(label, q) {
    if (!q) return esc(label);
    const i = norm(label).indexOf(norm(q));
    if (i < 0) return esc(label);
    return (
      esc(label.slice(0, i)) +
      "<mark>" +
      esc(label.slice(i, i + q.length)) +
      "</mark>" +
      esc(label.slice(i + q.length))
    );
  }

  // scope limits results to one kind; candidates and parties are not bundled in the demo
  const NO_DATA = window.KVSAMPLE ? ["strana"] : ["kandidát", "strana"];
  function search(q, scope, limit = 6) {
    const n = norm(q.trim());
    if (NO_DATA.includes(scope)) return [];
    const pool = scope ? ITEMS.filter((it) => it.kind === scope) : ITEMS;
    if (!n) return scope ? pool.slice(0, limit) : DEFAULTS;
    return pool
      .map((it) => ({ it, at: norm(it.label).indexOf(n) }))
      .filter((r) => r.at >= 0)
      .sort((a, b) => a.at - b.at || a.it.label.length - b.it.label.length)
      .slice(0, limit)
      .map((r) => r.it);
  }
  const GROUPS = { kandidát: "Kandidáti", obec: "Obce", okres: "Okresy", voľba: "Voľby" };

  // where a chosen result leads, relative to the form's data-base (pages folder)
  const slugify = (s) => norm(s).replace(/^okres /, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function hrefFor(item, base) {
    if (item.kind === "kandidát") return base + "profil.html#" + item.slug;
    if (item.kind === "voľba") return base + "kandidati.html#" + (/Predseda/.test(item.label) ? "predseda-nsk" : "poslanci-nsk");
    return base + "kandidati.html#" + slugify(item.label);
  }

  const emit = (type, detail) =>
    document.dispatchEvent(new CustomEvent(type, { detail }));

  function attach(form, idx) {
    const input = form.querySelector("input");
    const list = form.querySelector("[data-results]");
    const status = form.querySelector("[data-status]");
    const listId = list.id || "kv-results-" + idx;
    list.id = listId;
    list.setAttribute("role", "listbox");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");

    let results = [];
    let active = -1;

    function render() {
      const scope = form.dataset.scope || "";
      const grouped = "group" in form.dataset;
      results = search(input.value, scope, +form.dataset.limit || 6);
      if (grouped) {
        const order = Object.keys(GROUPS);
        results.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      }
      const q = input.value.trim();
      if (!results.length) {
        list.innerHTML = NO_DATA.includes(scope)
          ? '<li class="r-empty">V ukážke nie sú údaje o kandidátoch a stranách. V ostrej verzii sa tu zobrazia z databázy.</li>'
          : '<li class="r-empty">Nič sa nenašlo pre „' +
            esc(q) +
            "“. Skúste názov obce alebo priezvisko.</li>";
      } else {
        list.innerHTML = results
          .map(
            (r, i) =>
              (grouped && (i === 0 || results[i - 1].kind !== r.kind)
                ? '<li class="r-group" role="presentation">' +
                  GROUPS[r.kind] +
                  "</li>"
                : "") +
              '<li role="option" id="' +
              listId +
              "-" +
              i +
              '" data-i="' +
              i +
              '" aria-selected="' +
              (i === active) +
              '">' +
              '<span class="r-kind">' +
              r.kind +
              "</span>" +
              '<span class="r-label">' +
              highlight(r.label, q) +
              "</span>" +
              '<span class="r-meta">' +
              esc(r.meta) +
              "</span></li>",
          )
          .join("");
      }
      open(true);
    }

    function open(on) {
      list.hidden = !on;
      form.classList.toggle("is-open", on);
      input.setAttribute("aria-expanded", String(on));
      if (!on) {
        active = -1;
        input.removeAttribute("aria-activedescendant");
        emit("kv:blur");
      }
    }

    function setActive(i) {
      active = i;
      list
        .querySelectorAll("[role=option]")
        .forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
      if (i >= 0) {
        input.setAttribute("aria-activedescendant", listId + "-" + i);
        emit("kv:focus", results[i]);
      }
    }

    function choose(item) {
      if (!item) return;
      input.value = item.label;
      open(false);
      emit("kv:focus", item);
      emit("kv:choose", item);
      if (status) {
        status.textContent =
          item.kind === "obec"
            ? item.label +
              " (" +
              item.meta +
              "): tu sa otvorí hlasovací lístok obce so štyrmi voľbami."
            : item.label +
              ": tu sa otvorí stránka voľby s kandidátmi v poradí podľa lístka.";
      }
      // forms with data-base navigate to the page for the chosen result
      if ("base" in form.dataset) location.href = hrefFor(item, form.dataset.base);
    }

    input.addEventListener("focus", render);
    input.addEventListener("input", () => {
      active = -1;
      render();
      if (results[0]) emit("kv:focus", results[0]);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (list.hidden) render();
        setActive(Math.min(active + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(Math.max(active - 1, 0));
      } else if (e.key === "Escape") {
        if (list.hidden) input.value = "";
        open(false);
      }
    });
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const li = e.target.closest("[data-i]");
      if (li) choose(results[+li.dataset.i]);
    });
    list.addEventListener("mousemove", (e) => {
      const li = e.target.closest("[data-i]");
      if (li && +li.dataset.i !== active) setActive(+li.dataset.i);
    });
    input.addEventListener("blur", () => setTimeout(() => open(false), 80));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const scope = form.dataset.scope || "";
      choose(
        results[active >= 0 ? active : 0] || search(input.value, scope)[0],
      );
      if (!search(input.value, scope).length && status)
        status.textContent = "Pre „" + input.value + "“ sa nič nenašlo.";
    });

    // scope pills inside the form: <button data-scope="obec" data-ph="…">
    form.querySelectorAll("[data-scope]").forEach((b) =>
      b.addEventListener("click", () => {
        form.dataset.scope = b.dataset.scope;
        form
          .querySelectorAll("[data-scope]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (b.dataset.ph) input.placeholder = b.dataset.ph;
        input.focus();
        render();
      }),
    );

    // quick-pick buttons: <button data-fill="Nitra">, tied to this form when inside it,
    // named by data-for, or when the page has a single search
    const single = document.querySelectorAll("form[data-search]").length === 1;
    [...document.querySelectorAll("[data-fill]")]
      .filter((b) =>
        b.dataset.for
          ? b.dataset.for === form.id
          : b.closest("form") === form || single,
      )
      .forEach((b) =>
        b.addEventListener("click", () => {
          input.value = b.dataset.fill;
          input.focus();
          render();
          if (results[0]) {
            setActive(0);
          }
        }),
      );
    list.hidden = true;
  }

  document.querySelectorAll("form[data-search]").forEach(attach);

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing =
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
    if (
      (e.key === "/" && !typing) ||
      (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))
    ) {
      const first = [
        ...document.querySelectorAll("form[data-search] input"),
      ].find((i) => i.offsetParent !== null);
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Polls: Saturday 24 Oct 2026, 7:00–20:00 CEST
  const OPEN = Date.parse("2026-10-24T07:00:00+02:00");
  const CLOSE = Date.parse("2026-10-24T20:00:00+02:00");
  function phase(now = Date.now()) {
    if (now < OPEN) return { phase: "before", ms: OPEN - now };
    if (now < CLOSE) return { phase: "open", ms: CLOSE - now };
    return { phase: "closed", ms: 0 };
  }
  function parts(ms) {
    const s = Math.floor(ms / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
    };
  }
  const pad = (n) => String(n).padStart(2, "0");

  window.KV = { OKRESY, OBCE, phase, parts, pad, norm };
})();
