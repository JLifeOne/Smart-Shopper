#!/usr/bin/env python3
"""
Validate that the food-dictionary markdown CSV blocks are machine-parseable.

Why this exists:
- The generator (`scripts/generate_western_catalog.py`) consumes the CSV blocks in
  `docs/data/food-dictionary-western-part{2,3,4}.md` using Python's `csv` module.
- If rows have the wrong number of columns, aliases/variants/packaging get shifted,
  silently corrupting downstream catalog + classifier inputs.

This script is intentionally strict and reports:
- unexpected/missing headers
- per-row field-count mismatches with file + line numbers

Run:
  python3 scripts/validate_food_dictionary_csv.py
"""

from __future__ import annotations

import csv
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PARTS = [
    ROOT / "docs" / "data" / "food-dictionary-western-part2.md",
    ROOT / "docs" / "data" / "food-dictionary-western-part3.md",
    ROOT / "docs" / "data" / "food-dictionary-western-part4.md",
]

EXPECTED_HEADER = [
    "Item",
    "Category",
    "JM",
    "TT",
    "PR",
    "DO",
    "HT",
    "US",
    "CA",
    "MX",
    "BR",
    "CO",
    "Variants",
    "Packaging",
]


@dataclass(frozen=True)
class CsvIssue:
    path: Path
    line_no: int
    message: str
    raw_line: str


def iter_csv_blocks(lines: list[str]) -> list[tuple[int, list[str]]]:
    blocks: list[tuple[int, list[str]]] = []
    i = 0
    while i < len(lines):
        line = lines[i].lstrip("\ufeff")
        if line.startswith("Item,Category,"):
            start_line_no = i + 1
            block = [line]
            i += 1
            while i < len(lines):
                next_line = lines[i]
                if not next_line.strip():
                    break
                if next_line.startswith("---") or next_line.startswith("#"):
                    break
                if next_line.startswith("## "):
                    break
                block.append(next_line)
                i += 1
            blocks.append((start_line_no, block))
        else:
            i += 1
    return blocks


def validate_file(path: Path) -> tuple[int, int, list[CsvIssue]]:
    if not path.exists():
        return 0, 0, [CsvIssue(path=path, line_no=0, message="missing file", raw_line="")]

    lines = path.read_text(encoding="utf-8").splitlines()
    blocks = iter_csv_blocks(lines)
    issues: list[CsvIssue] = []

    total_rows = 0
    for start_line_no, block_lines in blocks:
        reader = csv.reader(block_lines)
        header = next(reader, None)
        if not header:
            issues.append(
                CsvIssue(
                    path=path,
                    line_no=start_line_no,
                    message="empty CSV header",
                    raw_line=block_lines[0] if block_lines else "",
                )
            )
            continue

        if header != EXPECTED_HEADER:
            issues.append(
                CsvIssue(
                    path=path,
                    line_no=start_line_no,
                    message=f"unexpected header: got {header} expected {EXPECTED_HEADER}",
                    raw_line=block_lines[0],
                )
            )

        expected_len = len(header)
        for offset, row in enumerate(reader, start=1):
            total_rows += 1
            if len(row) != expected_len:
                raw_line = block_lines[offset] if offset < len(block_lines) else ""
                issues.append(
                    CsvIssue(
                        path=path,
                        line_no=start_line_no + offset,
                        message=f"field count mismatch: got {len(row)} expected {expected_len}",
                        raw_line=raw_line,
                    )
                )

    return len(blocks), total_rows, issues


def main() -> int:
    total_blocks = 0
    total_rows = 0
    all_issues: list[CsvIssue] = []

    for path in CSV_PARTS:
        blocks, rows, issues = validate_file(path)
        total_blocks += blocks
        total_rows += rows
        all_issues.extend(issues)

    if not all_issues:
        print(f"Food dictionary CSV validation: OK ({total_blocks} blocks, {total_rows} rows).")
        return 0

    print(
        f"Food dictionary CSV validation: FAILED ({total_blocks} blocks, {total_rows} rows, {len(all_issues)} issues).",
        file=sys.stderr,
    )
    print(
        "Tip: Each CSV row must have exactly 14 columns matching the header (including empty placeholders).",
        file=sys.stderr,
    )

    max_items = 60
    for issue in all_issues[:max_items]:
        location = f"{issue.path.relative_to(ROOT)}:{issue.line_no}" if issue.line_no else str(issue.path.relative_to(ROOT))
        print(f"- {location}: {issue.message}", file=sys.stderr)
        if issue.raw_line.strip():
            print(f"  {issue.raw_line}", file=sys.stderr)

    if len(all_issues) > max_items:
        print(f"... plus {len(all_issues) - max_items} more issues.", file=sys.stderr)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
