/* Sheet loading shared by index.html (list view) and graph.html (graph view).
 *
 * Both pages embed a snapshot of the three sheet tabs (PROJECTS / SERVICES /
 * MAPS, written between the DATA markers by build.py), paint from it
 * immediately, then call loadLive() to refresh from the published sheet.
 *
 * The CSV column names below mirror build.py's parsers — a sheet schema change
 * has to be made in both places.
 */

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=0&single=true&output=csv";
const CATALOG_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=554397184&single=true&output=csv";
const MAPS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=1984372056&single=true&output=csv";

/* ---- small shared helpers ---- */
const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const splitList = v => (v || "").split(",").map(s => s.trim()).filter(s => s && s !== "--");
const uniq = a => [...new Set(a)];
const isFeat = p => (p.featured || "").toLowerCase() === "yes";
const ESC = s => (s || "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

/* `dominio` is free text: a bare host, a host + path, or a whole URL down to
   the query string. Link through domainURL(), print through domainLabel() —
   never concatenate a scheme onto it by hand. */
const domainURL = d => { const v = (d || "").trim(); return /^https?:\/\//i.test(v) ? v : "https://" + v; };
const domainLabel = d => (d || "").trim().replace(/^https?:\/\//i, "").replace(/\?.*$/, "").replace(/\/+$/, "");

/* ---- join the deployed list with the services catalog ---- */
function serviceIndex(services) {
  const idx = {};
  (services || []).forEach(s => { if (s.name) idx[norm(s.name)] = s; });
  return idx;
}

/* The services a deployed row points at: its (possibly comma-separated)
   `servizio` cell, falling back to a catalog entry named after the domain. */
function servicesFor(p, idx) {
  const svcs = splitList(p.service).map(n => idx[norm(n)]).filter(Boolean);
  if (!svcs.length && idx[norm(p.domain)]) return [idx[norm(p.domain)]];
  return svcs;
}

/* Maps are the named things a service hosts — OFM's worlds, say — filed under
   the service name in the `Project` column. That column is a list: a map used
   by several services ("OFM, GaiaWM") is one map, indexed under each of them. */
function mapIndex(maps) {
  const idx = {};
  (maps || []).forEach(m => {
    splitList(m.project).forEach(pr => {
      const k = norm(pr);
      (idx[k] = idx[k] || []).push(m);
    });
  });
  return idx;
}

/* Every map of every service a deployed row runs, each listed once however
   many of those services share it. */
function mapsFor(p, midx, svcs) {
  const keys = uniq(svcs.map(s => norm(s.name)).concat(splitList(p.service).map(norm)));
  return uniq(keys.flatMap(k => midx[k] || []));
}

function enrich(projects, services, maps) {
  const idx = serviceIndex(services);
  const midx = mapIndex(maps);
  return projects.map(p => {
    const svcs = servicesFor(p, idx);
    return Object.assign({}, p, {
      types: uniq(svcs.flatMap(s => splitList(s.type))),
      subtypes: uniq(svcs.flatMap(s => splitList(s.subtype))),
      repos: uniq(svcs.map(s => s.repo).filter(Boolean)),
      uses: uniq(svcs.flatMap(s => splitList(s.uses))),
      packages: uniq(svcs.map(s => s.package).filter(Boolean)),
      // The deployed row carries its own description now; the catalog's
      // Descrizione only still covers services described nowhere else.
      description: p.description || svcs.map(s => s.description).find(Boolean) || "",
      // The catalog files every service under an `ecosistema` of its own, which
      // can differ from the ecosystem the domain is deployed in.
      ecosystems: uniq([p.ecosystem].concat(svcs.flatMap(s => splitList(s.ecosystem))).filter(Boolean)),
      maps: mapsFor(p, midx, svcs),
    });
  });
}

/* ---- tiny RFC-4180-ish CSV parser ---- */
function parseCSV(text) {
  const rows = []; let row = [], field = "", i = 0, inQ = false;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
    i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToProjects(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  const idx = name => head.indexOf(name);
  // The display-name column keeps moving: it is headed "e" today, used to be
  // blank (exported as "Column 1"), and "name" is the obvious future. Take the
  // first of those that exists — and never a bare "Column N", which is now the
  // sheet's reversed-domain sort key.
  const nameIdx = ["name", "e", "column 1"].reduce(
    (found, want) => found >= 0 ? found : head.findIndex(h => h.toLowerCase() === want), -1);
  const c = { name: nameIdx, dom: idx("dominio"), eco: idx("ecosystem"), svc: idx("servizio"),
    be: idx("BE hosting"), fe: idx("FE hosting"), oth: idx("others"), desc: idx("description"),
    st: idx("status"), fwd: idx("forward to"), att: idx("attention"), fea: idx("featured") };
  const g = (r, k) => (k >= 0 && r[k] != null ? r[k].trim() : "");
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (g(row, c.st).toLowerCase() !== "deployed") continue;
    out.push({ name: g(row, c.name), domain: g(row, c.dom), ecosystem: g(row, c.eco), service: g(row, c.svc),
      be: g(row, c.be), fe: g(row, c.fe), others: g(row, c.oth), description: g(row, c.desc),
      forward: g(row, c.fwd), attention: g(row, c.att), featured: g(row, c.fea) });
  }
  out.sort((a, b) => (a.ecosystem.toLowerCase() || "zzz").localeCompare(b.ecosystem.toLowerCase() || "zzz") || a.domain.toLowerCase().localeCompare(b.domain.toLowerCase()));
  return out;
}

function csvToServices(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  const idx = name => head.indexOf(name);
  const c = { name: idx("Servizio"), type: idx("type"), sub: idx("subtype"), pkg: idx("package"),
    eco: idx("ecosistema"), uses: idx("uses"), repo: idx("Repo"), desc: idx("Descrizione") };
  const g = (r, k) => (k >= 0 && r[k] != null ? r[k].trim() : "");
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!g(row, c.name)) continue;
    out.push({ name: g(row, c.name), type: g(row, c.type), subtype: g(row, c.sub), package: g(row, c.pkg),
      ecosystem: g(row, c.eco), uses: g(row, c.uses), repo: g(row, c.repo), description: g(row, c.desc) });
  }
  return out;
}

function csvToMaps(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  const idx = name => head.indexOf(name);
  const c = { proj: idx("Project"), name: idx("Name"), url: idx("url"), fran: idx("franchise") };
  const g = (r, k) => (k >= 0 && r[k] != null ? r[k].trim() : "");
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!g(row, c.name)) continue;
    out.push({ project: g(row, c.proj), name: g(row, c.name),
      url: g(row, c.url), franchise: g(row, c.fran) });
  }
  return out;
}

/* Fetch all three tabs. Resolves with the deployed rows plus the catalog and
   the maps (null when those tabs are unreachable — callers fall back to
   the embedded snapshot). Rejects only if the deployed tab itself fails. */
function loadLive() {
  const soft = url => fetch(url, { cache: "no-store" }).then(r => r.ok ? r.text() : "").catch(() => "");
  return Promise.all([
    fetch(CSV_URL, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    soft(CATALOG_URL),
    soft(MAPS_URL),
  ]).then(([pText, sText, iText]) => ({
    projects: csvToProjects(pText),
    services: sText ? csvToServices(sText) : null,
    maps: iText ? csvToMaps(iText) : null,
  }));
}

/* ---- presentation helpers shared by both views ---- */
function hostClass(token) {
  const t = token.toLowerCase();
  if (t.includes("gh") || t.includes("pages") || t.includes("github")) return "gh";
  if (t.includes("netlify")) return "net";
  if (t.includes("vercel")) return "ver";
  if (t.includes("server")) return "srv";
  if (t.includes("cloudflare")) return "cf";
  if (t.includes("medium") || t.includes("substack")) return "pub";
  return "ext";
}
function hostTokens(v) {
  return (v || "").split(/[,/]/).map(s => s.trim()).filter(s => s && s !== "--");
}
/* Service types are free text in the catalog; norm() folds "RPG Manual" and
   friends onto a class name. An unknown type falls back to the generic badge. */
const TYPE_KEYS = ["spa", "backend", "blog", "library", "manual", "rpgmanual", "webfront", "docker", "desktop"];
const TYPE_CLASS = t => "t-" + (TYPE_KEYS.includes(norm(t)) ? norm(t) : "other");
const repoLabel = u => u.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "") || u;

/* `package` mixes npm names, docker image refs and plain store URLs (itch.io,
   a hosted demo) — only the last of those is worth linking. */
const pkgURL = v => /^https?:\/\//i.test((v || "").trim()) ? (v || "").trim() : "";
const pkgLabel = v => pkgURL(v) ? domainLabel(v) : (v || "").trim();
const pkgHTML = v => {
  const u = pkgURL(v);
  return u
    ? `<a class="repo" href="${ESC(u)}" target="_blank" rel="noopener" title="${ESC(u)}">${PKG_SVG}${ESC(pkgLabel(v))}</a>`
    : `<span class="repo pkg" title="package">${PKG_SVG}${ESC(pkgLabel(v))}</span>`;
};
const GH_SVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;
const PKG_SVG = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.7 14 5v6l-6 3.3L2 11V5z"/><path d="M2 5l6 3.3L14 5M8 8.3v6"/></svg>`;
