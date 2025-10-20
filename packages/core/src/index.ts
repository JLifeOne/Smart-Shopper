import { z } from 'zod';

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  locale: z.string().default('en-JM'),
  currency: CurrencyCodeSchema.default('JMD'),
  preferences: z
    .object({
      includeTaxInComparisons: z.boolean().default(true),
      defaultStoreId: z.string().nullable()
    })
    .default(() => ({
      includeTaxInComparisons: true,
      defaultStoreId: null
    }))
});

export type User = z.infer<typeof UserSchema>;

export const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  address: z.string().optional(),
  geo: z
    .object({
      lat: z.number(),
      lng: z.number()
    })
    .optional()
});

export type Store = z.infer<typeof StoreSchema>;

export const SizeSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'oz', 'fl_oz', 'lb', 'ct'])
});

export type Unit = z.infer<typeof SizeSchema>['unit'];

export const ProductSchema = z.object({
  id: z.string(),
  brand: z.string().optional(),
  name: z.string(),
  category: z.string(),
  size: SizeSchema,
  barcode: z.string().optional()
});

export type Product = z.infer<typeof ProductSchema>;

export const ProductAliasSchema = z.object({
  productId: z.string(),
  rawName: z.string(),
  storeId: z.string().optional()
});

export type ProductAlias = z.infer<typeof ProductAliasSchema>;

export const PricePointSchema = z.object({
  id: z.string(),
  productId: z.string(),
  storeId: z.string(),
  price: z.number().nonnegative(),
  currency: CurrencyCodeSchema,
  timestamp: z.date(),
  source: z.enum(['receipt', 'user', 'import']),
  discount: z
    .object({
      type: z.enum(['amount', 'percent']),
      value: z.number().nonnegative()
    })
    .optional(),
  size: SizeSchema.optional()
});

export type PricePoint = z.infer<typeof PricePointSchema>;

export const ListSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z
    .string()
    .min(1)
    .max(60),
  shared: z.boolean().default(false)
});

export type List = z.infer<typeof ListSchema>;

export const ListItemSchema = z.object({
  id: z.string(),
  listId: z.string(),
  productId: z.string().nullable(),
  label: z.string(),
  desiredQty: z.number().positive().default(1),
  substitutionsOk: z.boolean().default(true),
  notes: z.string().optional()
});

export type ListItem = z.infer<typeof ListItemSchema>;

export const InventoryItemSchema = z.object({
  userId: z.string(),
  productId: z.string(),
  quantityOnHand: z.number().nonnegative().default(0),
  lastPurchaseAt: z.date().nullable(),
  estDaysLeft: z.number().nonnegative().nullable()
});

export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const AlertSchema = z.object({
  userId: z.string(),
  productId: z.string(),
  ruleType: z.enum(['target_price', 'percent_drop']),
  threshold: z.number().positive(),
  active: z.boolean().default(true)
});

export type Alert = z.infer<typeof AlertSchema>;

const UNIT_CONVERSION_TABLE: Record<Unit, Partial<Record<BaseUnit | Unit, number>>> = {
  g: { g: 1, kg: 0.001 },
  kg: { g: 1000, kg: 1 },
  ml: { ml: 1, l: 0.001 },
  l: { ml: 1000, l: 1 },
  oz: { oz: 1, lb: 0.0625 },
  lb: { oz: 16, lb: 1 },
  fl_oz: { ml: 29.5735, l: 0.0295735, fl_oz: 1 },
  ct: { ct: 1 }
};

export type BaseUnit = 'g' | 'ml' | 'oz' | 'ct';

const CATEGORY_UNITS: Record<string, BaseUnit> = {
  produce: 'g',
  pantry: 'g',
  dairy: 'ml',
  beverages: 'ml',
  household: 'oz',
  personal_care: 'oz',
  pet: 'oz',
  baby: 'oz',
  other: 'ct'
};

export interface NormalizePriceInput {
  price: number;
  size: { value: number; unit: Unit };
  category: string;
  baseUnitOverride?: BaseUnit;
}

export function getBaseUnit(category: string, override?: BaseUnit): BaseUnit {
  if (override) {
    return override;
  }
  return CATEGORY_UNITS[category] ?? 'ct';
}

export function convertToBaseUnit({
  size,
  category,
  baseUnitOverride
}: Omit<NormalizePriceInput, 'price'>): number {
  const baseUnit = getBaseUnit(category, baseUnitOverride);
  const conversionMap = UNIT_CONVERSION_TABLE[size.unit];
  if (!conversionMap) {
    throw new Error(`Unsupported unit "${size.unit}"`);
  }
  const ratio = conversionMap[baseUnit];
  if (ratio === undefined) {
    throw new Error(`Cannot convert ${size.unit} to ${baseUnit}`);
  }
  return size.value * ratio;
}

export function getUnitPrice({
  price,
  size,
  category,
  baseUnitOverride
}: NormalizePriceInput): number {
  if (price <= 0) {
    throw new Error('Price must be positive');
  }
  const baseQuantity = convertToBaseUnit({ size, category, baseUnitOverride });
  if (baseQuantity <= 0) {
    throw new Error('Base quantity must be positive');
  }
  return Number((price / baseQuantity).toFixed(4));
}

export interface PriceWindow {
  current: number;
  movingAverage: number;
}

export function calculateTrend({ current, movingAverage }: PriceWindow): number {
  if (movingAverage <= 0) {
    return 0;
  }
  return Number((((current - movingAverage) / movingAverage) * 100).toFixed(2));
}

export interface CheapestStoreCandidate {
  storeId: string;
  unitPrice: number;
  updatedAt: Date;
}

export function determineCheapestStore(
  candidates: CheapestStoreCandidate[],
  lookbackDays = 60
): CheapestStoreCandidate | undefined {
  const now = Date.now();
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const filtered = candidates.filter(
    (candidate) => now - candidate.updatedAt.getTime() <= lookbackMs
  );
  return filtered.sort((a, b) => a.unitPrice - b.unitPrice)[0];
}

export interface TrendChip {
  direction: 'up' | 'down' | 'flat';
  percent: number;
}

export function toTrendChip(percentChange: number, threshold = 0.5): TrendChip {
  if (percentChange > threshold) {
    return { direction: 'up', percent: percentChange };
  }
  if (percentChange < -threshold) {
    return { direction: 'down', percent: percentChange };
  }
  return { direction: 'flat', percent: percentChange };
}

export function classifyPriceColor(
  unitPrice: number,
  minUnitPrice: number,
  { yellowDelta = 0.05, redDelta = 0.1 }: { yellowDelta?: number; redDelta?: number } = {}
): 'green' | 'yellow' | 'red' | 'gray' {
  if (!Number.isFinite(unitPrice) || !Number.isFinite(minUnitPrice)) {
    return 'gray';
  }
  if (unitPrice <= minUnitPrice) {
    return 'green';
  }
  const delta = (unitPrice - minUnitPrice) / minUnitPrice;
  if (delta <= yellowDelta) {
    return 'yellow';
  }
  if (delta >= redDelta) {
    return 'red';
  }
  return 'yellow';
}

export const HeatmapCellSchema = z.object({
  date: z.string(),
  spend: z.number().nonnegative(),
  savings: z.number().nullable(),
  volatilityCount: z.number().nonnegative()
});

export type HeatmapCell = z.infer<typeof HeatmapCellSchema>;
