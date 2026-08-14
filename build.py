#!/usr/bin/env python3
"""Regenerate the embedded data snapshot inside the views.

Two published Google Sheet tabs feed the pages:
  * gid=0          -> the deployed-domains list (status = "deployed")
  * gid=554397184  -> the services catalog (type / subtype / repo / description …)

The browser joins them on the service name; this script just bakes a snapshot
of both tabs into every view (between the DATA:START / DATA:END markers) as a
fallback for when the sheets are unreachable. The pages also live-fetch both
tabs on load.

Usage:
    python3 build.py                         # fetch both tabs live
    python3 build.py deployed.csv catalog.csv # build from local CSV files
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

BASE = ("https://docs.google.com/spreadsheets/d/e/"
        "2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i"
        "/pub?gid={gid}&single=true&output=csv")
DEPLOYED_URL = BASE.format(gid="0")
CATALOG_URL = BASE.format(gid="554397184")
HERE = Path(__file__).parent
VIEWS = [HERE / "index.html", HERE / "graph.html"]   # every page carrying the DATA markers


def load_csv(url, local=None):
    if local:
        text = Path(local).read_text(encoding="utf-8")
    else:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def name_key(rows):
    """The display-name column has a blank header (exported as 'Column 1');
    prefer a real 'name' header if the sheet ever gets one."""
    keys = list(rows[0].keys()) if rows else []
    for k in keys:
        if (k or "").strip().lower() == "name":
            return k
    return "Column 1" if "Column 1" in keys else None


def clean_projects(rows):
    nk = name_key(rows)
    out = []
    for r in rows:
        g = lambda k: (r.get(k) or "").strip()
        if g("status").lower() != "deployed":
            continue
        out.append({
            "name": g(nk) if nk else "",
            "domain": g("dominio"),
            "ecosystem": g("ecosystem"),
            "service": g("servizio"),
            "be": g("BE hosting"),
            "fe": g("FE hosting"),
            "others": g("others"),
            "forward": g("forward to"),
            "attention": g("attention"),
            "featured": g("featured"),
        })
    out.sort(key=lambda x: (x["ecosystem"].lower() or "zzz", x["domain"].lower()))
    return out


def clean_services(rows):
    out = []
    for r in rows:
        g = lambda k: (r.get(k) or "").strip()
        if not g("Servizio"):
            continue
        out.append({
            "name": g("Servizio"),
            "type": g("type"),
            "subtype": g("subtype"),
            "package": g("package"),
            "uses": g("uses"),
            "repo": g("Repo"),
            "description": g("Descrizione"),
        })
    return out


def main():
    a = sys.argv
    projects = clean_projects(load_csv(DEPLOYED_URL, a[1] if len(a) > 1 else None))
    services = clean_services(load_csv(CATALOG_URL, a[2] if len(a) > 2 else None))
    block = (
        "/* DATA:START */\n"
        f"const PROJECTS = {json.dumps(projects, ensure_ascii=False, indent=2)};\n"
        f"const SERVICES = {json.dumps(services, ensure_ascii=False, indent=2)};\n"
        "/* DATA:END */"
    )
    written = []
    for view in VIEWS:
        html = view.read_text(encoding="utf-8")
        html, n = re.subn(r"/\* DATA:START \*/.*?/\* DATA:END \*/", lambda _: block, html, flags=re.DOTALL)
        if not n:
            raise SystemExit(f"{view.name}: DATA:START / DATA:END markers not found")
        view.write_text(html, encoding="utf-8")
        written.append(view.name)
    print(f"Wrote {len(projects)} deployed projects + {len(services)} catalog services "
          f"into {', '.join(written)}")


if __name__ == "__main__":
    main()
