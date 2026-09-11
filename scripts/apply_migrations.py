"""Apply the database schema + migrations to a Supabase project.

Uses the Supabase Management API (project owner access token), so no CLI or
psql is needed. Runs each file in order and reports per-file results.

Usage:
    python scripts/apply_migrations.py --token-file path/to/token.txt [--project nknhmztsshosmunfpbip]

The token is a personal access token from
https://supabase.com/dashboard/account/tokens
"""
import argparse
import json
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "database" / "schema.sql"
MIGRATIONS = sorted((ROOT / "database" / "migrations").glob("*.sql"))
API = "https://api.supabase.com/v1/projects/{ref}/database/query"


def run_query(ref: str, token: str, query: str) -> tuple[int, str]:
    req = urllib.request.Request(
        API.format(ref=ref),
        data=json.dumps({"query": query}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode()[:400]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--token-file", required=True, help="file containing the Supabase access token")
    ap.add_argument("--project", default="nknhmztsshosmunfpbip", help="project ref from the dashboard URL")
    args = ap.parse_args()

    token = Path(args.token_file).read_text(encoding="utf-8").strip()
    if not token or token.lower().startswith("sb_"):
        raise SystemExit("token missing or looks like a project key, not a personal access token")

    files = [("schema.sql", SCHEMA)] + [
        (p.name, p) for p in MIGRATIONS if p.name != "0001_baseline.sql"
    ]
    failures = 0
    for name, path in files:
        query = path.read_text(encoding="utf-8")
        status, body = run_query(args.project, token, query)
        ok = status in (200, 201)
        print(f"[{'OK' if ok else 'FAIL'}] {name} ({status})")
        if not ok:
            print("   ", body[:500].replace("\n", " "))
            failures += 1
    print(f"done. {len(files) - failures}/{len(files)} succeeded")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())