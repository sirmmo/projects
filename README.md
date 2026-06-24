# Deployed Projects

A navigable directory of every **deployed** project across the sirmmo ecosystems,
generated from a published Google Sheet.

🔗 **Live site:** https://sirmmo.github.io/projects/

## What it shows

Each card is a deployed domain, grouped by ecosystem, with:

- the live domain (click to open),
- the service it runs (+ subtype: `gh page`, `itch.io`, `npm`, `docker`),
- **service type** badges — SPA, Backend, Blog, Library, Manual, Webfront,
- a description and a link to the **source repo**,
- frontend / backend hosting badges (GH Pages, Netlify, Vercel, Server, …),
- a health dot (green = ok, amber = *needs attention*),
- forward-to targets where set.

Search (`/`), filter by ecosystem, filter by service type, or filter to *needs attention*.

## How it stays current

Two tabs of the published Google Sheet feed the page:

| Tab | What it provides |
| --- | --- |
| [`gid=0`](https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=0&single=true&output=csv) | deployed domains (`status = deployed`), hosting, ecosystem |
| [`gid=554397184`](https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=554397184&single=true&output=csv) | services catalog — `type`, `subtype`, `package`, `uses`, `Repo`, `Descrizione` |

The page joins them in the browser on the service name (case/punctuation
insensitive; a domain-name fallback and multi-service entries are handled), so a
deployed domain is enriched with its catalog metadata.

1. **In the browser** — `index.html` fetches the sheet live on load, so the
   directory reflects the sheet in real time.
2. **Embedded snapshot** — a copy of the data is baked into `index.html` as a
   fallback (works offline / if the sheet is unreachable).
3. **Daily refresh** — `.github/workflows/refresh.yml` re-runs the build once a
   day so the embedded snapshot never drifts far from the sheet.

## Rebuild the snapshot locally

```bash
python3 build.py                         # fetch both tabs live
python3 build.py deployed.csv catalog.csv # or build from downloaded CSVs
```

The script rewrites the data block (`PROJECTS` + `SERVICES`) between the
`DATA:START` / `DATA:END` markers in `index.html`. No dependencies beyond the
Python standard library.
