"""Lightweight secret scanner for the repo.

Searches committed source for high-risk credential patterns and exits non-zero
if anything matches. Cheap stand-in for gitleaks; run before any commit/deploy:

    python scripts/secret_scan.py

Patterns are deliberately conservative to avoid flagging harmless test values.
"""
import re
import subprocess
import sys
from pathlib import Path

EXCLUDE_DIRS = {".git", ".venv", "node_modules", "dist", "__pycache__", "data", ".idea", ".vscode"}
EXCLUDE_FILES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock"}

PATTERNS = [
    ("supabase-service-key", re.compile(r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\s*['\"]\s*[,}]", re.M)),
    ("openai-key", re.compile(r"\bsk-[A-Za-z0-9]{20,}")),
    ("anthropic-key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{20,}")),
    ("private-key-block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}")),
    ("github-token", re.compile(r"\bghp_[A-Za-z0-9]{36,}")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}")),
    ("stripe-live-key", re.compile(r"\bsk_live_[A-Za-z0-9]{20,}")),
    ("admin-token-literal", re.compile(r"(?:ADMIN_TOKEN|service_?role[_-]?key|SUPABASE_SERVICE_KEY)\s*=\s*['\"](?!\$\{|<)[^'\" ]+")),
]

ROOT = Path(__file__).resolve().parents[1]
SKIP_FILE_SUFFIXES = (".pyc", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".eot", ".ttf", ".map", ".pdf")


def _is_gitignored(rel: Path) -> bool:
    try:
        r = subprocess.run(
            ["git", "-C", str(ROOT), "check-ignore", "--quiet", str(rel).replace("\\", "/")],
            capture_output=True,
        )
        return r.returncode == 0
    except Exception:
        return False


def scan() -> int:
    hits = 0
    for path in sorted(ROOT.rglob("*")):
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            continue
        if not path.is_file() or rel.name in EXCLUDE_FILES or path.suffix.lower() in SKIP_FILE_SUFFIXES:
            continue
        if _is_gitignored(rel):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for label, rx in PATTERNS:
            for match in rx.finditer(text):
                snippet = text[max(0, match.start() - 20): match.end() + 20].replace("\n", " ")
                print(f"[{label}] {rel} :: ...{snippet}...")
                hits += 1
    return hits


if __name__ == "__main__":
    n = scan()
    if n:
        print(f"\nFound {n} potential secret(s). Remove them from the repo before shipping.")
        sys.exit(1)
    print("No high-risk secrets found.")