# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static GitHub Pages site (`https://sirmmo.github.io/projects/`) that renders a
directory of deployed projects from a **published Google Sheet**. Two views over
the same data: `index.html` (cards) and `graph.html` (force-directed network).

No build system, no package manager, no dependencies, no tests. Python standard
library + vanilla browser JS only — keep it that way.

## Commands

```bash
python3 build.py                          # refetch both sheet tabs, rewrite the embedded snapshots
python3 build.py deployed.csv catalog.csv # same, from local CSVs (offline)
python3 -m http.server                    # preview at http://localhost:8000
```

There is no linter or test suite. To sanity-check a JS change without a browser:

```bash
python3 -c "import re,pathlib;print(re.search(r'<script>\n(.*?)\n</script>',pathlib.Path('graph.html').read_text(),re.S).group(1))" > /tmp/x.js
node --check /tmp/x.js
```

## The data model

Two tabs of one published sheet, joined **in the browser** on the service name:

| Tab | Rows | Key columns |
| --- | --- | --- |
| `gid=0` — deployed domains | one per deployed domain | `e` (display name), `dominio`, `ecosystem`, `servizio`, `BE hosting`, `FE hosting`, `others`, `status`, `forward to`, `attention`, `featured`, `description` |
| `gid=554397184` — services catalog | one per service | `Servizio`, `type`, `subtype`, `package`, `ecosistema`, `uses`, `Repo`, `Descrizione` |

Things that will bite you:

- Column names are **mixed Italian/English** and the display-name column keeps
  moving: it is headed `e` today and used to be blank (exported as `Column 1`).
  Both parsers take the first of `name` / `e` / `Column 1` that exists, and
  deliberately ignore any other `Column N` — the sheet now uses one of those for
  a reversed-domain sort key.
- `dominio` is free text: a bare host, a host + path, or a whole URL down to the
  query string. Link through `domainURL()`, print through `domainLabel()` —
  never concatenate a scheme onto it.
- Descriptions live on the **deployed row** (`description`); the catalog's
  `Descrizione` is only the fallback for services described nowhere else.
- Both tabs carry an ecosystem, and they disagree on purpose: `ecosystem` is the
  one the *domain* is deployed in, `ecosistema` the one the *service* is filed
  under. The graph unions them (deployment first, so it keeps the node colour);
  the list view groups by the deployed row's.
- Only rows with `status = deployed` are kept.
- The join is on `norm(name)` (lowercased, non-alphanumerics stripped), with a
  fallback to a catalog entry named after the domain. `servizio` may be a
  comma-separated list — one domain can run several services.
- `--` is a "not set" placeholder throughout, filtered out by `splitList()`.

**The schema is parsed twice**: `build.py` (`clean_projects` / `clean_services`)
for the snapshot, and `sheet.js` (`csvToProjects` / `csvToServices`) for the live
fetch. A sheet column change means editing both.

## Architecture

Three layers of freshness, by design:

1. Each view boots from an **embedded snapshot** — `PROJECTS` and `SERVICES`
   literals between the `/* DATA:START */` and `/* DATA:END */` markers — so the
   page renders instantly and still works with the sheet unreachable.
2. It then calls `loadLive()` and re-renders from the sheet, flipping the header
   status pill from *snapshot* to *live*.
3. `.github/workflows/refresh.yml` runs `build.py` daily and commits the result,
   so the snapshot never drifts far.

`build.py` only ever rewrites the text between those markers, in every file in
its `VIEWS` list. **The markers are the contract** — don't reformat or remove
them, and add any new view to `VIEWS`.

Shared code:

- `sheet.js` — sheet URLs, `parseCSV`, the two row parsers, `norm`/`splitList`/
  `uniq`/`ESC`, the `enrich()` join, and presentation helpers (`hostClass`,
  `TYPE_CLASS`, `repoLabel`, `GH_SVG`). Loaded as a classic script before each
  view's inline script, so **everything in it is a global** — don't redeclare
  those names in a view or the page dies with a redeclaration error.
- `shell.css` — design tokens, header, view switch, search, chips, badge
  vocabulary. View-specific layout stays in each file's inline `<style>`.

### index.html (list view)

`state` object → `matches()` filter → `render()` rebuilds everything via
`innerHTML` string templating. Every interpolation goes through `ESC()`. Cards
are grouped by ecosystem, with featured ones showcased on the unfiltered landing
view only. Accepts `?q=` to preseed the search.

### graph.html (graph view)

`buildGraph()` turns the same rows into a graph whose **nodes are services**
(the `uses` column connects service names, so services — not domains — are the
natural node) enriched with the deployed rows running them. Ecosystem hub nodes
are synthesised, otherwise most of the graph would be isolated vertices. Edge
kinds: `uses`, `eco`, `fwd`, `repo`.

- Layout is a plain O(n²) spring/charge simulation (~90 nodes, so no quadtree).
  `alpha` cools per tick; `reheat()` restarts the rAF loop.
- Initial positions come from a **seeded PRNG** (`mulberry32`) — the same graph
  every load. Hubs are seeded before services, because services are placed
  relative to their hub.
- Services with no edge at all carry no relational information and are parked on
  an ellipse by `placeLoose()` instead of being simulated.
- Shapes draw in world space; **all text draws in screen space** at a fixed size,
  and `nodeR()` has a screen-space floor, so labels stay readable at any zoom.
  Use `px(v)` for anything that should be a constant number of screen pixels.
  `drawLabels()` drops labels that would collide with one already placed.
- Hit testing shares `nodeR()` with drawing — keep them in agreement. Hub pills
  store `w`/`h` divided by `view.s` for the same reason.
- Accepts `?focus=<service|ecosystem>`, falling back to a search highlight.

Free-text sheet values are mapped to CSS classes by `hostClass()` and
`TYPE_CLASS()`; a new hosting provider or service type needs a matching class in
`shell.css` or it silently falls back to the generic style.

## Deployment

GitHub Pages serves the repo root (`.nojekyll` is present, so every file ships).
Pushing to the default branch deploys. The daily workflow commits `index.html`
and `graph.html` as `chore: refresh deployed-projects snapshot` — expect that
noise in the log, and rebase rather than fight it.
