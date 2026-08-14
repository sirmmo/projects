/* Sheet loading shared by index.html (list view) and graph.html (graph view).
 *
 * Both pages embed a snapshot of the two sheet tabs (PROJECTS / SERVICES,
 * written between the DATA markers by build.py), paint from it immediately,
 * then call loadLive() to refresh from the published sheet.
 *
 * The CSV column names below mirror build.py's parsers — a sheet schema change
 * has to be made in both places.
 */

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=0&single=true&output=csv";
const CATALOG_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=554397184&single=true&output=csv";

/* ---- small shared helpers ---- */
const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const splitList = v => (v || "").split(",").map(s => s.trim()).filter(s => s && s !== "--");
const uniq = a => [...new Set(a)];
const isFeat = p => (p.featured || "").toLowerCase() === "yes";
const ESC = s => (s || "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

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

function enrich(projects, services) {
  const idx = serviceIndex(services);
  return projects.map(p => {
    const svcs = servicesFor(p, idx);
    return Object.assign({}, p, {
      types: uniq(svcs.flatMap(s => splitList(s.type))),
      subtypes: uniq(svcs.flatMap(s => splitList(s.subtype))),
      repos: uniq(svcs.map(s => s.repo).filter(Boolean)),
      uses: uniq(svcs.flatMap(s => splitList(s.uses))),
      packages: uniq(svcs.map(s => s.package).filter(Boolean)),
      description: (svcs.map(s => s.description).find(Boolean)) || "",
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
  // The display-name column has a blank header, exported as "Column 1".
  let nameIdx = head.findIndex(h => h.toLowerCase() === "name");
  if (nameIdx < 0) nameIdx = idx("Column 1");
  const c = { name: nameIdx, dom: idx("dominio"), eco: idx("ecosystem"), svc: idx("servizio"),
    be: idx("BE hosting"), fe: idx("FE hosting"), oth: idx("others"),
    st: idx("status"), fwd: idx("forward to"), att: idx("attention"), fea: idx("featured") };
  const g = (r, k) => (k >= 0 && r[k] != null ? r[k].trim() : "");
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (g(row, c.st).toLowerCase() !== "deployed") continue;
    out.push({ name: g(row, c.name), domain: g(row, c.dom), ecosystem: g(row, c.eco), service: g(row, c.svc),
      be: g(row, c.be), fe: g(row, c.fe), others: g(row, c.oth),
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
  const c = { name: idx("Servizio"), type: idx("type"), sub: idx("subtype"),
    pkg: idx("package"), uses: idx("uses"), repo: idx("Repo"), desc: idx("Descrizione") };
  const g = (r, k) => (k >= 0 && r[k] != null ? r[k].trim() : "");
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!g(row, c.name)) continue;
    out.push({ name: g(row, c.name), type: g(row, c.type), subtype: g(row, c.sub),
      package: g(row, c.pkg), uses: g(row, c.uses), repo: g(row, c.repo), description: g(row, c.desc) });
  }
  return out;
}

/* Fetch both tabs. Resolves with the deployed rows plus the catalog (null when
   the catalog tab is unreachable — callers fall back to the embedded snapshot).
   Rejects only if the deployed tab itself fails. */
function loadLive() {
  return Promise.all([
    fetch(CSV_URL, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch(CATALOG_URL, { cache: "no-store" }).then(r => r.ok ? r.text() : "").catch(() => ""),
  ]).then(([pText, sText]) => ({
    projects: csvToProjects(pText),
    services: sText ? csvToServices(sText) : null,
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
  return "ext";
}
function hostTokens(v) {
  return (v || "").split(/[,/]/).map(s => s.trim()).filter(s => s && s !== "--");
}
const TYPE_CLASS = t => "t-" + (["spa", "backend", "blog", "library", "manual", "webfront"].includes(t.toLowerCase()) ? t.toLowerCase() : "other");
const repoLabel = u => u.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "") || u;
const GH_SVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;
