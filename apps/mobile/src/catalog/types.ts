export type CatalogPrice = {
  store: string;
  unitPrice: number;
  currency: string;
  capturedAt?: number;
};

export type CatalogRecord = {
  name: string;
  category: string;
  brand?: string | null;
  variant?: string | null;
  sizeValue?: number;
  sizeUnit?: string;
  barcode?: string | null;
  tags?: string[];
  sourceUrl?: string | null;
  imageUrl?: string | null;
  region?: string;
  prices?: CatalogPrice[];
};

export type CatalogBundle = {
  region: string;
  version: string;
  updatedAt: number;
  products: CatalogRecord[];
};
