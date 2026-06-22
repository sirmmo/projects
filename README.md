# Deployed Projects

A navigable directory of every **deployed** project across the sirmmo ecosystems,
generated from a published Google Sheet.

🔗 **Live site:** https://sirmmo.github.io/projects/

## What it shows

Each card is a deployed domain, grouped by ecosystem, with:

- the live domain (click to open),
- the service it runs,
- frontend / backend hosting badges (GH Pages, Netlify, Vercel, Server, …),
- a health dot (green = ok, amber = *needs attention*),
- forward-to targets where set.

Search (`/`), filter by ecosystem, or filter to *needs attention*.

## How it stays current

The source of truth is the [published Google Sheet CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i/pub?gid=0&single=true&output=csv).
The page filters rows where `status = deployed`.

1. **In the browser** — `index.html` fetches the sheet live on load, so the
   directory reflects the sheet in real time.
2. **Embedded snapshot** — a copy of the data is baked into `index.html` as a
   fallback (works offline / if the sheet is unreachable).
3. **Daily refresh** — `.github/workflows/refresh.yml` re-runs the build once a
   day so the embedded snapshot never drifts far from the sheet.

## Rebuild the snapshot locally

```bash
python3 build.py            # fetch the live sheet
python3 build.py local.csv  # or build from a downloaded CSV
```

The script rewrites the data block between the `DATA:START` / `DATA:END`
markers in `index.html`. No dependencies beyond the Python standard library.
