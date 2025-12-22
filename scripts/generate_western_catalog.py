#!/usr/bin/env python3
import csv
import hashlib
import json
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
DATA_PART1 = ROOT / "docs" / "data" / "food-dictionary-western-part1.md"
DATA_PART2 = ROOT / "docs" / "data" / "food-dictionary-western-part2.md"
DATA_PART3 = ROOT / "docs" / "data" / "food-dictionary-western-part3.md"
DATA_PART4 = ROOT / "docs" / "data" / "food-dictionary-western-part4.md"
DICT_TS_PATH = ROOT / "supabase" / "functions" / "_shared" / "food-dictionary-western-part1.ts"
CATALOG_TS_PATH = ROOT / "apps" / "mobile" / "src" / "catalog" / "data" / "western-shared.ts"

CATEGORY_MAP: Dict[str, str] = {
    "Baking Supplies": "pantry",
    "Bakery": "bakery",
    "Beverages": "beverages",
    "Breakfast & Cereal": "pantry",
    "Canned & Jarred": "pantry",
    "Condiments & Sauces": "pantry",
    "Dairy & Eggs": "dairy",
    "Frozen Foods": "frozen",
    "Grains": "pantry",
    "Grains, Rice & Pasta": "pantry",
    "International & Latin": "pantry",
    "Meat & Poultry": "meat_seafood",
    "Nuts, Seeds & Dried Fruit": "pantry",
    "Nuts/Seeds/Dried Fruit": "pantry",
    "Oils & Vinegars": "pantry",
    "Produce": "produce",
    "Produce>Herbs": "produce",
    "Produce>Vegetables": "produce",
    "Produce>Fruits": "produce",
    "Seafood": "meat_seafood",
    "Snacks": "snacks",
    "Spices & Seasonings": "pantry",
    "Sweets & Desserts": "snacks",
}

PRICE_RANGES: Dict[str, Tuple[float, float]] = {
    "produce": (1.2, 4.5),
    "dairy": (2.5, 7.0),
    "meat_seafood": (5.0, 18.0),
    "bakery": (2.0, 6.0),
    "pantry": (1.5, 9.0),
    "beverages": (1.2, 5.5),
    "frozen": (3.0, 11.0),
    "snacks": (1.0, 4.5),
}

REGION_COLUMNS = ["JM", "TT", "PR", "DO", "HT", "US", "CA", "MX", "BR", "CO"]

PACKAGING_TOKEN_MAP = [
    ("bottle", "bottle"),
    ("canister", "can"),
    ("can", "can"),
    ("jar", "jar"),
    ("tin", "tin"),
    ("bag", "bag"),
    ("box", "box"),
    ("tub", "tub"),
    ("carton", "carton"),
    ("sachet", "sachet"),
    ("pouch", "pouch"),
    ("tray", "tray"),
    ("wrap", "wrap"),
    ("paper sleeve", "sleeve"),
    ("bundle", "bunch"),
    ("bunch", "bunch"),
    ("clamshell", "clamshell"),
    ("loose", "ea"),
    ("pack", "pack"),
]

STORE_BY_REGION: Dict[str, List[str]] = {
    "us": ["Whole Foods", "Trader Joe's", "Sysco", "Safeway", "US Foods"],
    "jm": ["Hi-Lo Foods", "MegaMart", "Progressive Grocers", "Fontana Market", "General Foods"],
    "cn": ["Hema Fresh", "Carrefour China", "Ole Supermarket", "Metro China", "City Shop"],
}

FX = {"us": 1.0, "jm": 155.0, "cn": 7.2}
CURRENCY = {"us": "USD", "jm": "JMD", "cn": "CNY"}

REGION_KEYWORDS_JM = [
    "jm", "jamaica", "jerk", "callaloo", "coco bread", "plantain", "gungo", "sorrel",
    "chocho", "escallion", "scotch bonnet", "ackee", "saltfish", "malta", "kola champagne",
    "yuca", "cassava", "batata", "grace", "curry powder", "goat", "coco-bread", "caribbean",
    "pimento", "culantro", "dhalpuri", "buss-up-shut", "yuca", "gandules", "gungo peas",
]

REGION_KEYWORDS_CN = [
    "bok choy", "soy", "rice", "dragon fruit", "starfruit", "ginger", "tamarind",
    "fish sauce", "five-spice", "rice vinegar", "rice noodles", "bok", "pak choi",
    "lychee", "kiwi", "mango", "passion", "bok choi", "chili garlic", "sriracha",
    "teriyaki", "catfish", "snapper", "tilapia", "mahi", "starfruit", "ginger root",
]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def split_multi(value: str) -> List[str]:
    if not value:
        return []
    normalized = value.replace("&", "/")
    parts = re.split(r"[\/,\|]", normalized)
    cleaned = []
    for part in parts:
        token = part.strip().strip(".")
        if token:
            cleaned.append(token)
    return cleaned


def parse_variants(value: str) -> List[str]:
    if not value:
        return []
    return [token.strip() for token in value.split("|") if token.strip()]


def parse_aliases(value: str) -> List[str]:
    return [match.strip() for match in re.findall(r'"([^"]+)"', value)]


def map_category(raw_category: str) -> Tuple[str, List[str]]:
    base, _, sub = raw_category.partition(">")
    base = base.strip()
    sub = sub.strip()
    category = CATEGORY_MAP.get(raw_category) or CATEGORY_MAP.get(base) or "pantry"
    tags = []
    if base:
        tags.append(base.lower())
    if sub:
        tags.append(sub.lower())
    return category, tags


def clean_alias_text(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return ""
    cleaned = re.sub(r"\(≈\)", "", cleaned)
    cleaned = cleaned.replace("?", "")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def determine_regions(name: str, aliases: List[str], category: str) -> List[str]:
    text = f"{name} {' '.join(aliases)}".lower()
    regions = set()
    for marker in REGION_KEYWORDS_JM:
        if marker in text:
            regions.add("jm")
            break
    for marker in REGION_KEYWORDS_CN:
        if marker in text:
            regions.add("cn")
            break
    # baseline hashed assignment to balance coverage
    hashed = int(hashlib.sha1(name.encode("utf-8")).hexdigest(), 16)
    chooser = hashed % 10
    if chooser < 5:
        regions.add("us")
    elif chooser < 8:
        regions.add("jm")
    else:
        regions.add("cn")
    # ensure professional staples always in US
    regions.add("us")
    return sorted(regions)


def price_for_item(name: str, category: str, region: str) -> float:
    low, high = PRICE_RANGES.get(category, (2.0, 8.0))
    hashed = int(hashlib.sha1((name + region).encode("utf-8")).hexdigest()[:8], 16)
    scale = (hashed % 1000) / 999
    usd_price = low + (high - low) * scale
    regional_price = usd_price * FX[region]
    if region == "jm":
        return round(regional_price)
    return round(regional_price, 2)


def packaging_to_unit(packaging: List[str]) -> str:
    for pkg in packaging:
        token = pkg.lower()
        for needle, unit in PACKAGING_TOKEN_MAP:
            if needle in token:
                return unit
    return "ea"


def parse_markdown() -> List[Dict]:
    items = []
    if not DATA_PART1.exists():
        return items
    with DATA_PART1.open(encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped.startswith("* **"):
                continue
            normalized = stripped.replace("—", "--")
            match = re.match(r'\* \*\*(.+?)\*\* -- category ([^;]+); (.+)', normalized)
            if not match:
                raise ValueError(f"Unable to parse line: {line}")
            name = match.group(1).strip()
            raw_category = match.group(2).strip()
            rest = match.group(3).strip()
            fields = {}
            for chunk in rest.split(";"):
                chunk = chunk.strip().rstrip(".")
                if not chunk or ":" not in chunk:
                    continue
                key, value = chunk.split(":", 1)
                fields[key.strip().lower()] = value.strip()
            category, tags = map_category(raw_category)
            aliases = parse_aliases(fields.get("aliases", ""))
            variants = split_multi(fields.get("variants", ""))
            packaging = split_multi(fields.get("packaging", ""))
            entry = {
                "name": name,
                "raw_category": raw_category,
                "category": category,
                "aliases": aliases,
                "variants": variants,
                "packaging": packaging,
                "tags": tags,
                "source_tag": "western-v0.1",
            }
            items.append(entry)
    return items


CSV_DATA_FILES = [DATA_PART2, DATA_PART3, DATA_PART4]


def parse_csv_tables() -> List[Dict]:
    items: List[Dict] = []

    def flush_table(buffer: List[str], section: str):
        if not buffer:
            return
        reader = csv.DictReader(buffer)
        for row in reader:
            name = (row.get("Item") or "").strip()
            if not name:
                continue
            raw_category = (row.get("Category") or section or "Pantry").strip()
            category, tags = map_category(raw_category)
            alias_values = []
            for col in REGION_COLUMNS:
                alias = clean_alias_text(row.get(col, ""))
                if alias:
                    alias_values.append(alias)
            variants = parse_variants(row.get("Variants", ""))
            packaging = split_multi(row.get("Packaging", ""))
            items.append({
                "name": name,
                "raw_category": raw_category,
                "category": category,
                "aliases": alias_values,
                "variants": variants,
                "packaging": packaging,
                "tags": tags + [raw_category.lower()],
                "source_tag": "western-v0.2",
            })

    for csv_path in CSV_DATA_FILES:
        if not csv_path.exists():
            continue
        current_section = ""
        table_lines: List[str] = []
        with csv_path.open(encoding="utf-8") as handle:
            for raw in handle:
                stripped = raw.strip()
                if stripped.startswith("## "):
                    flush_table(table_lines, current_section)
                    table_lines = []
                    current_section = stripped[3:].split("(")[0].strip()
                    continue
                if not stripped or stripped.startswith("---"):
                    flush_table(table_lines, current_section)
                    table_lines = []
                    continue
                if stripped.startswith("Item,"):
                    flush_table(table_lines, current_section)
                    table_lines = [raw]
                    continue
                if table_lines:
                    table_lines.append(raw)
            flush_table(table_lines, current_section)
    return items


def format_ts_value(value, indent=0):
    space = " " * indent
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isfinite(value) is False:
            raise ValueError("Non-finite number")
        return str(value)
    if value is None:
        return "null"
    if isinstance(value, list):
        if not value:
            return "[]"
        inner = ", ".join(format_ts_value(v, indent) for v in value)
        return f"[{inner}]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        parts = []
        for key, val in value.items():
            parts.append(f"{space}  {key}: {format_ts_value(val, indent + 2)}")
        return "{\n" + ",\n".join(parts) + f"\n{space}}}"
    raise TypeError(f"Unsupported type: {type(value)}")


def write_dictionary_ts(items: List[Dict]):
    seeds = []
    for item in items:
        seed = {
            "category": item["category"],
            "product": item["name"],
            "aliases": item["aliases"],
            "variants": item["variants"] or None,
            "packaging": item["packaging"] or None,
            "tags": sorted(
                set(
                    item["tags"]
                    + [item.get("source_tag", "western-shared")]
                    + [v.lower() for v in item["variants"]]
                )
            ),
        }
        # Remove None fields
        seed = {k: v for k, v in seed.items() if v}
        seeds.append(seed)
    lines = ["import type { ExpandableSeed } from './food-dictionary-types.ts';", "", "export const westernPart1Seeds: ExpandableSeed[] = ["]
    for seed in seeds:
        lines.append("  {")
        for key, value in seed.items():
            ts_value = format_ts_value(value, 4)
            lines.append(f"    {key}: {ts_value},")
        lines.append("  },")
    lines.append("];")
    DICT_TS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_catalog_records(items: List[Dict]):
    captured_at = int(datetime(2025, 1, 15).timestamp()) * 1000
    by_region = {"jm": [], "us": [], "cn": []}
    for item in items:
        regions = determine_regions(item["name"], item["aliases"], item["category"])
        base_unit = packaging_to_unit(item["packaging"])
        tags = sorted(set(item["tags"] + ["western-shared", "culinary", item["category"]]))
        for region in regions:
            store_list = STORE_BY_REGION[region]
            # NOTE: Do not use Python's built-in `hash()` here. Since Python 3.3 it is
            # randomized per-process (PYTHONHASHSEED) which would make this script's
            # output non-deterministic across runs/machines.
            store_hash = int(
                hashlib.sha1(f"{item['name']}|{region}|store".encode("utf-8")).hexdigest()[:8],
                16,
            )
            store_index = store_hash % len(store_list)
            record = {
                "name": item["name"],
                "category": item["category"],
                "sizeValue": 1,
                "sizeUnit": base_unit,
                "tags": tags,
                "region": region.upper(),
                "prices": [
                    {
                        "store": store_list[store_index],
                        "unitPrice": price_for_item(item["name"], item["category"], region),
                        "currency": CURRENCY[region],
                        "capturedAt": captured_at,
                    }
                ],
            }
            by_region[region].append(record)
    # sort for determinism
    for region in by_region:
        by_region[region] = sorted(by_region[region], key=lambda rec: rec["name"])
    return by_region


def write_catalog_ts(by_region: Dict[str, List[Dict]]):
    header = [
        "import type { CatalogRecord } from '../types';",
        "",
        "export type WesternSharedCatalog = {",
        "  jm: CatalogRecord[];",
        "  us: CatalogRecord[];",
        "  cn: CatalogRecord[];",
        "};",
        "",
        "export const WESTERN_SHARED_VERSION = '2025.11.12-v0.2';",
        "export const WESTERN_SHARED_COUNT = {",
        f"  jm: {len(by_region['jm'])},",
        f"  us: {len(by_region['us'])},",
        f"  cn: {len(by_region['cn'])},",
        "};",
        "",
        "export const westernSharedCatalog: WesternSharedCatalog = {",
    ]
    body = []
    for region in ("jm", "us", "cn"):
        body.append(f"  {region}: [")
        for record in by_region[region]:
            body.append("    {")
            for key, value in record.items():
                ts_value = format_ts_value(value, 6)
                body.append(f"      {key}: {ts_value},")
            body.append("    },")
        body.append("  ],")
    footer = ["};"]
    CATALOG_TS_PATH.write_text("\n".join(header + body + footer) + "\n", encoding="utf-8")


def main():
    items = parse_markdown() + parse_csv_tables()
    if len(items) < 800:
        raise ValueError(f"Expected >=800 combined items, found {len(items)}")
    write_dictionary_ts(items)
    catalog = build_catalog_records(items)
    total = sum(len(records) for records in catalog.values())
    if total < 250:
        raise ValueError("Generated catalog below 250 entries")
    write_catalog_ts(catalog)
    print(f"Generated {len(items)} dictionary seeds and {total} catalog records.")


if __name__ == "__main__":
    main()
