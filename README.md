# Deployed Projects

A navigable directory of every **deployed** project across the sirmmo ecosystems,
generated from a published Google Sheet.

🔗 **Live site:** https://sirmmo.github.io/projects/

## What it shows

**Featured** projects (`featured = yes`) are showcased in a gold rail at the top
of the landing view, carry a ★ marker on their card, and have their own filter.

Each card is a deployed project, grouped by ecosystem, with:

- its **name** as the headline (falls back to the domain), with the live
  domain/URL shown underneath when it differs,
- the service it runs (+ subtype: `gh page`, `itch.io`, `npm`, `docker`),
- **service type** badges — SPA, Backend, Blog, Library, Manual, Webfront,
- a description and a link to the **source repo**,
- frontend / backend hosting badges (GH Pages, Netlify, Vercel, Server, …),
- a health dot (green = ok, amber = *needs attention*),
- forward-to targets where set.

Search (`/`), filter by ecosystem, filter by service type, or filter to *needs attention*.

## Graph view

`graph.html` is a second view of the same data — the ecosystems as a force-directed
graph instead of a list. Nodes are **services** (from the catalog tab), sized by how
connected they are and coloured by ecosystem; edges are:

| Edge | Meaning |
| --- | --- |
| **uses** | the catalog's `uses` column — service depends on service |
| **ecosystem** | a service belongs to an ecosystem hub |
| **forwards** | a deployed domain's `forward to` target |
| **shared repo** | two services built from the same repository |

Services in the catalog with no deployed domain show as dashed "catalog only"
nodes; the ones with no connection at all are parked on the outer ring rather than
being left to drift through the middle.

Drag nodes, drag the background to pan, scroll to zoom, hover to isolate a
neighbourhood, click for a detail panel, double-click to open the live site.
The chips filter, the search box highlights, and **Edges** toggles each edge type.
The two views deep-link into each other — a card's *graph* link opens
`graph.html?focus=<service>`, and the panel's *open in the list view* goes back to
`index.html?q=<name>`.

## How it stays current

Three tabs of the published Google Sheet feed the page:

| Tab | What it provides |
| --- | --- |
| [`gid=0`](https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=0&single=true&output=csv) | deployed domains (`status = deployed`), name, hosting, ecosystem, description |
| [`gid=554397184`](https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=554397184&single=true&output=csv) | services catalog — `type`, `subtype`, `package`, `ecosistema`, `uses`, `Repo`, `Descrizione` |
| [`gid=1984372056`](https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=1984372056&single=true&output=csv) | maps a service hosts — `Project`, `Name`, `url`, `franchise` |

The page joins them in the browser on the service name (case/punctuation
insensitive; a domain-name fallback and multi-service entries are handled), so a
deployed domain is enriched with its catalog metadata.

1. **In the browser** — both views fetch the sheet live on load, so the
   directory reflects the sheet in real time.
2. **Embedded snapshot** — a copy of the data is baked into each view as a
   fallback (works offline / if the sheet is unreachable).
3. **Daily refresh** — `.github/workflows/refresh.yml` re-runs the build once a
   day so the embedded snapshot never drifts far from the sheet.

## Files

| File | What it is |
| --- | --- |
| `index.html` | the list view — cards grouped by ecosystem |
| `graph.html` | the graph view — same data as a network |
| `sheet.js` | shared: sheet URLs, CSV parsing, the projects × catalog join |
| `shell.css` | shared: design tokens, header, search, chips, badges |
| `build.py` | bakes the snapshot into both views |

## Rebuild the snapshot locally

```bash
python3 build.py                         # fetch both tabs live
python3 build.py deployed.csv catalog.csv # or build from downloaded CSVs
python3 -m http.server                   # then open http://localhost:8000
```

The script rewrites the data block (`PROJECTS` + `SERVICES`) between the
`DATA:START` / `DATA:END` markers in every view. No dependencies beyond the
Python standard library.
