// Builds designs/homepage/geo.js from geoBoundaries ADM2 (okresy) and ADM3 (obce) for the Nitra region.
// Usage: node build-geo.mjs <geoBoundaries-SVK-ADM2_simplified.geojson> <geoBoundaries-SVK-ADM3_simplified.geojson> <wikidata-obce.json> <out geo.js>
// Inputs: github.com/wmgeolab/geoBoundaries releaseData/gbOpen/SVK/{ADM2,ADM3}; Wikidata SPARQL of places in districts of Q184548 with P625 and P31.
import fs from "node:fs";
const [, , adm2Path, adm3Path, wdPath, outPath] = process.argv;
// geoBoundaries mangles diacritics in names; map its district names back
const ALIAS = {
  Komprno: "Komárno",
  Levice: "Levice",
  Nitra: "Nitra",
  "Nova Zkmky": "Nové Zámky",
  Gala: "Šaľa",
  Topolcany: "Topoľčany",
  "Zlatc Moravce": "Zlaté Moravce",
};
const OKRESY = {
  Komárno: 41,
  Levice: 89,
  Nitra: 62,
  "Nové Zámky": 62,
  Šaľa: 13,
  Topoľčany: 54,
  "Zlaté Moravce": 33,
};
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates); // list of polygons, each = rings
const K = Math.cos((48.2 * Math.PI) / 180);

function inRing(ring, x, y) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      c = !c;
  }
  return c;
}
const inGeom = (g, x, y) =>
  polys(g).some(
    (p) => inRing(p[0], x, y) && !p.slice(1).some((h) => inRing(h, x, y)),
  );
function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    a += (r[j][0] * K - r[i][0] * K) * (r[j][1] + r[i][1]);
  return a / 2;
}
function centroid(g) {
  // area-weighted centroid of the largest outer ring, nudged inside if it falls outside
  const p = polys(g)
    .map((pp) => pp[0])
    .sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
  let cx = 0,
    cy = 0,
    a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    cx += (p[j][0] + p[i][0]) * f;
    cy += (p[j][1] + p[i][1]) * f;
    a += f;
  }
  let c = [cx / (3 * a), cy / (3 * a)];
  if (!inGeom(g, ...c))
    c = p.reduce(
      (s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length],
      [0, 0],
    );
  return c;
}
// km² from lon/lat with a local equirectangular approximation
const km2 = (g) =>
  polys(g).reduce(
    (s, p) =>
      s +
      Math.abs(ringArea(p[0])) -
      p.slice(1).reduce((h, r) => h + Math.abs(ringArea(r)), 0),
    0,
  ) *
  111.32 *
  111.32;

function simplify(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0,
      mi = -1;
    const [ax, ay] = [pts[a][0] * K, pts[a][1]],
      [bx, by] = [pts[b][0] * K, pts[b][1]];
    const L = Math.hypot(bx - ax, by - ay) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d =
        Math.abs(
          (bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0] * K) * (by - ay),
        ) / L;
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol) {
      keep[mi] = 1;
      stack.push([a, mi], [mi, b]);
    }
  }
  const out = pts.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : pts;
}
const pack = (g, tol) =>
  polys(g).map((p) =>
    p.map((r) =>
      simplify(r, tol).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]),
    ),
  );

const okresy = read(adm2Path)
  .features.map((f) => ({
    name: ALIAS[f.properties.shapeName.replace(/^District of /, "")],
    geom: f.geometry,
  }))
  .filter((o) => o.name);
// correct Slovak names come from Wikidata municipalities (Q6784672), matched by point-in-polygon
const WD = JSON.parse(fs.readFileSync(wdPath, "utf8"))
  .results.bindings.filter(
    (b) =>
      b.types &&
      b.types.value
        .split(",")
        .includes("http://www.wikidata.org/entity/Q6784672"),
  )
  .map((b) => {
    const m = b.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    return {
      name: b.oLabel.value,
      okres: b.dLabel.value.replace(/^okres /, ""),
      x: +m[1],
      y: +m[2],
      id: b.o.value.split("/").pop(),
    };
  });
const plain = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const sim = (a, b) => {
  a = plain(a);
  b = plain(b);
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) n += a[i] === b[i];
  return n / Math.max(a.length, b.length);
};
const used = new Set();
const review = [];
// Wikidata items without a Slovak label
const FIX = { Q973985: "Mužla" };
const obce = [];
// pass 1 collects polygons; a Wikidata point inside exactly one polygon names it
const feats = [];
for (const f of read(adm3Path).features) {
  const c = centroid(f.geometry);
  const ok = okresy.find((o) => inGeom(o.geom, ...c));
  if (ok) feats.push({ f, c, ok, w: null });
}
// pass 0: an exact name match (diacritics dropped) in the same okres is the strongest evidence;
// some Wikidata coordinates are rounded to arc-minutes and fall into a neighbouring obec
for (const ft of feats) {
  const raw = plain(ft.f.properties.shapeName);
  const hits = WD.filter(
    (w) => w.okres === ft.ok.name && plain(w.name) === raw,
  );
  if (hits.length === 1 && !used.has(hits[0].id)) {
    ft.w = hits[0];
    used.add(ft.w.id);
  }
}
for (const ft of feats.filter((x) => !x.w)) {
  const inside = WD.filter(
    (w) => !used.has(w.id) && inGeom(ft.f.geometry, w.x, w.y),
  );
  if (inside.length === 1) {
    ft.w = inside[0];
    used.add(ft.w.id);
  }
}
// pass 2a: leftovers whose name already reads correctly once diacritics are dropped
for (const ft of feats.filter((x) => !x.w)) {
  const raw = plain(ft.f.properties.shapeName);
  const hit = WD.find(
    (w) => !used.has(w.id) && w.okres === ft.ok.name && plain(w.name) === raw,
  );
  if (hit) {
    ft.w = hit;
    used.add(hit.id);
  }
}
// pass 2b: the rest pair up globally by shortest distance within the same okres
const pairs = [];
for (const ft of feats.filter((x) => !x.w))
  for (const w of WD.filter((w) => !used.has(w.id) && w.okres === ft.ok.name))
    pairs.push({ ft, w, d: Math.hypot((w.x - ft.c[0]) * K, w.y - ft.c[1]) });
pairs.sort((a, b) => a.d - b.d);
for (const { ft, w, d } of pairs) {
  if (ft.w || used.has(w.id)) continue;
  ft.w = w;
  used.add(w.id);
  review.push(
    `${ft.f.properties.shapeName} → ${w.name} (${(d * 111).toFixed(1)} km from centroid)`,
  );
}
for (const { f, c, ok, w } of feats) {
  if (!w) continue;
  obce.push({
    name: FIX[w.id] || w.name,
    okres: ok.name,
    c: c.map((v) => +v.toFixed(4)),
    km2: +km2(f.geometry).toFixed(2),
    rings: pack(f.geometry, 0.0012),
  });
}
console.log(
  "needs review:",
  review.length ? "\n  " + review.join("\n  ") : "none",
);
console.log(
  "wikidata municipalities not matched:",
  WD.filter((w) => !used.has(w.id))
    .map((w) => w.name + " (" + w.okres + ")")
    .join(", ") || "none",
);
const counts = Object.fromEntries(
  Object.keys(OKRESY).map((k) => [k, obce.filter((o) => o.okres === k).length]),
);
console.log("okresy found:", okresy.map((o) => o.name).join(", "));
console.log(
  "obce per okres (geo vs MV SR):",
  Object.entries(counts)
    .map(([k, v]) => `${k} ${v}/${OKRESY[k]}`)
    .join(", "),
  "total",
  obce.length,
);
const data = {
  source:
    "Hranice: geoBoundaries gbOpen SVK ADM2 + ADM3 (CC BY 4.0); názvy obcí: Wikidata (CC0)",
  okresy: okresy.map((o) => ({
    name: o.name,
    km2: +km2(o.geom).toFixed(1),
    rings: pack(o.geom, 0.0006),
  })),
  obce: obce.sort((a, b) => a.name.localeCompare(b.name, "sk")),
};
const js =
  "/* Generated from geoBoundaries (CC BY 4.0): 7 okresy and their obce in the Nitra region. Do not edit by hand. */\nwindow.KVGEO = " +
  JSON.stringify(data) +
  ";\n";
fs.writeFileSync(outPath, js);
console.log("wrote", outPath, (js.length / 1024).toFixed(0) + " KB");
