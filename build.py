#!/usr/bin/env python3
"""Regenerate the embedded deployed-projects snapshot inside index.html.

Source of truth is the published Google Sheet (CSV). This script fetches it,
keeps only the rows whose `status` is "deployed", normalises the fields, and
writes the result between the DATA:START / DATA:END markers in index.html.

The page also live-fetches the same CSV in the browser, so the embedded
snapshot is only a fallback (used when the sheet is unreachable / offline).

Usage:
    python3 build.py            # fetch the live sheet
    python3 build.py _source.csv  # build from a local CSV file
"""
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vRTgXiDl9xtdUWBDITRCkGW0n2W4fIdgoNjlMzWJphk1G7AE-8J9sv8rp8CGkrH51vshv1a8TUtcc_i"
    "/pub?gid=0&single=true&output=csv"
)
HTML = Path(__file__).with_name("index.html")


def load_csv(arg=None):
    if arg:
        text = Path(arg).read_text(encoding="utf-8")
    else:
        req = urllib.request.Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
        text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def clean(rows):
    out = []
    for r in rows:
        g = lambda k: (r.get(k) or "").strip()
        if g("status").lower() != "deployed":
            continue
        out.append({
            "domain": g("dominio"),
            "ecosystem": g("ecosystem"),
            "service": g("servizio"),
            "be": g("BE hosting"),
            "fe": g("FE hosting"),
            "others": g("others"),
            "forward": g("forward to"),
            "attention": g("attention"),
        })
    out.sort(key=lambda x: (x["ecosystem"].lower() or "zzz", x["domain"].lower()))
    return out


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    data = clean(load_csv(arg))
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    html = HTML.read_text(encoding="utf-8")
    block = f"/* DATA:START */\nconst PROJECTS = {payload};\n/* DATA:END */"
    html = re.sub(
        r"/\* DATA:START \*/.*?/\* DATA:END \*/",
        lambda _: block,
        html,
        flags=re.DOTALL,
    )
    HTML.write_text(html, encoding="utf-8")
    print(f"Wrote {len(data)} deployed projects into {HTML.name}")


if __name__ == "__main__":
    main()
