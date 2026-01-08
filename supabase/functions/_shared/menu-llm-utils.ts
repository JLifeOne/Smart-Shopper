import type { MenuPromptResponse } from "./menu-prompt-types.ts";

export type PackagingUnitInput = {
  pack_size: number | string | null;
  pack_unit: string | null;
  display_label: string | null;
};

export type IngredientMeta = {
  key: string;
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
};

export function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number.parseInt(fraction[1], 10);
    const denominator = Number.parseInt(fraction[2], 10);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUnit(unit?: string | null) {
  if (!unit) return null;
  const normalized = unit.toString().trim().toLowerCase();
  if (!normalized) return null;
  if (["g", "gram", "grams"].includes(normalized)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(normalized)) return "kg";
  if (["ml", "milliliter", "milliliters"].includes(normalized)) return "ml";
  if (["l", "liter", "litre", "liters", "litres"].includes(normalized)) return "l";
  if (["tsp", "teaspoon", "teaspoons"].includes(normalized)) return "tsp";
  if (["tbsp", "tablespoon", "tablespoons"].includes(normalized)) return "tbsp";
  if (["cup", "cups"].includes(normalized)) return "cup";
  if (["unit", "units"].includes(normalized)) return "unit";
  return normalized;
}

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  if (!Number.isFinite(quantity)) return null;
  if (fromUnit === toUnit) return quantity;
  if (fromUnit === "kg" && toUnit === "g") return quantity * 1000;
  if (fromUnit === "g" && toUnit === "kg") return quantity / 1000;
  if (fromUnit === "l" && toUnit === "ml") return quantity * 1000;
  if (fromUnit === "ml" && toUnit === "l") return quantity / 1000;
  return null;
}

export function formatPackagingLabel(meta: IngredientMeta, unit?: PackagingUnitInput) {
  const packSize = parseNumeric(unit?.pack_size);
  const packUnit = normalizeUnit(unit?.pack_unit ?? null);
  const displayLabel =
    unit?.display_label && unit.display_label.toString().trim().length
      ? unit.display_label.toString().trim()
      : packSize && packUnit
        ? `${packSize} ${packUnit}`
        : null;

  const qty = parseNumeric(meta.quantity);
  const qtyUnit = normalizeUnit(meta.unit ?? null);

  if (packSize && packUnit && qty && qtyUnit) {
    const converted = convertQuantity(qty, qtyUnit, packUnit);
    if (converted && Number.isFinite(converted) && converted > 0) {
      const packCount = Math.max(1, Math.ceil(converted / packSize));
      if (displayLabel) {
        return packCount === 1
          ? `Buy 1 × ${displayLabel} of ${meta.name}`
          : `Buy ${packCount} × ${displayLabel} of ${meta.name}`;
      }
    }
  }

  if (displayLabel) {
    return `Buy ${displayLabel} of ${meta.name}`;
  }

  if (qty && Number.isFinite(qty) && qty > 0) {
    const unitLabel = qtyUnit ? ` ${qtyUnit}` : "";
    return `Approx. ${qty}${unitLabel} of ${meta.name}`;
  }

  return `Buy ${meta.name}`;
}

export function sanitizeResponseShape(raw: MenuPromptResponse): MenuPromptResponse {
  const maxCards = 25;
  const cards = Array.isArray(raw.cards) ? raw.cards.slice(0, maxCards) : [];
  const sanitizedCards = cards.map((card, index) => {
    const ingredients = Array.isArray(card.ingredients) ? card.ingredients : [];
    const method = Array.isArray(card.method) ? card.method : [];
    const listLines = Array.isArray(card.list_lines) ? card.list_lines : [];
    const normalizedMethod = method
      .filter((step) => step && typeof step.text === "string" && step.text.trim().length)
      .map((step, idx) => ({ ...step, step: idx + 1 }));
    return {
      ...card,
      id: card.id && card.id.toString().trim().length ? card.id : `card-${index + 1}`,
      title: card.title?.toString().trim() ?? `Dish ${index + 1}`,
      ingredients,
      method: normalizedMethod,
      list_lines: listLines
    };
  });

  return {
    ...raw,
    cards: sanitizedCards,
    consolidated_list: Array.isArray(raw.consolidated_list) ? raw.consolidated_list : [],
    menus: Array.isArray(raw.menus) ? raw.menus : undefined,
    clarification_needed: Array.isArray(raw.clarification_needed) ? raw.clarification_needed : undefined
  };
}
