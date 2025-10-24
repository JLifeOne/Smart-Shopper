import re
import sys
from pathlib import Path


def scan_missing_commas(text: str) -> int:
    # Detect a closing brace followed by an identifier without a comma in between.
    # This commonly indicates a missing comma between style entries.
    pattern = re.compile(r"}\s+([A-Za-z_][A-Za-z0-9_]*)\s*:")
    count = 0
    for m in pattern.finditer(text):
        # Look backwards for a comma before the '}' on the same segment
        before = text[max(0, m.start() - 60):m.start()]
        if not re.search(r",\s*$", before):
            count += 1
    return count


def scan_duplicate_imports(text: str) -> int:
    """Detects duplicate value imports from the same module.

    Type‑only imports are allowed to co‑exist with one value import, and will not
    be flagged (e.g., `import type { Foo } from 'mod'`). This avoids false
    positives common in TS projects.
    """
    dup = 0
    modules: dict[str, dict[str, int]] = {}
    for line in text.splitlines():
        m = re.match(r"^\s*import\s+([^;]+?)\s+from\s+['\"]([^'\"]+)['\"];?\s*$", line)
        if not m:
            continue
        lhs, mod = m.groups()
        bucket = modules.setdefault(mod, {"value": 0, "type": 0})
        if lhs.strip().startswith("type "):
            bucket["type"] += 1
        else:
            bucket["value"] += 1
    for mod, counts in modules.items():
        if counts["value"] > 1:
            print(f"Duplicate import detected: {mod} value imports x{counts['value']}")
            dup += counts["value"] - 1
    return dup


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    target = repo_root / 'apps/mobile/app/(app)/home.tsx'
    if not target.exists():
        print('Target file not found:', target, file=sys.stderr)
        return 2
    text = target.read_text(encoding='utf-8', errors='ignore')

    issues = 0
    issues += scan_duplicate_imports(text)
    mc = scan_missing_commas(text)
    if mc:
        print(f"Potential missing commas between style entries: {mc}")
        issues += mc

    if issues:
        print(f"Sanity check found {issues} potential issue(s).")
    else:
        print("Sanity check passed: no duplicate imports or missing commas detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
