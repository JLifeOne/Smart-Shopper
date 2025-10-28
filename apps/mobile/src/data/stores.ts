export type StoreDefinition = {
  id: string;
  label: string;
  region: string;
  aisles: Array<{ category: string; label: string }>;
};

export const stores: StoreDefinition[] = [
  {
    id: 'jm-hilo-ochorios',
    label: 'Hi-Lo Ocho Rios',
    region: 'JM',
    aisles: [
      { category: 'produce', label: 'Produce' },
      { category: 'bakery', label: 'Bakery' },
      { category: 'dairy', label: 'Dairy' },
      { category: 'meat', label: 'Meats' },
      { category: 'pantry', label: 'Pantry' },
      { category: 'beverages', label: 'Drinks' },
      { category: 'household', label: 'Household' },
      { category: 'frozen', label: 'Frozen' },
      { category: 'pharmacy', label: 'Pharmacy' }
    ]
  },
  {
    id: 'jm-progressive-mobay',
    label: 'Progressive Montego Bay',
    region: 'JM',
    aisles: [
      { category: 'produce', label: 'Fresh Produce' },
      { category: 'deli', label: 'Deli & Bakery' },
      { category: 'seafood', label: 'Seafood' },
      { category: 'pantry', label: 'Pantry' },
      { category: 'snacks', label: 'Snacks' },
      { category: 'beverages', label: 'Beverages' },
      { category: 'personal_care', label: 'Personal Care' },
      { category: 'household', label: 'Household' },
      { category: 'pharmacy', label: 'Pharmacy' }
    ]
  },
  {
    id: 'jm-pricesmart-mobay',
    label: 'PriceSmart Montego Bay',
    region: 'JM',
    aisles: [
      { category: 'produce', label: 'Produce' },
      { category: 'bakery', label: 'Bakery' },
      { category: 'meat', label: 'Meat & Poultry' },
      { category: 'frozen', label: 'Frozen' },
      { category: 'household', label: 'Household' },
      { category: 'electronics', label: 'Electronics' },
      { category: 'pharmacy', label: 'Pharmacy' }
    ]
  },
  {
    id: 'jm-fontana',
    label: 'Fontana Pharmacy',
    region: 'JM',
    aisles: [
      { category: 'pharmacy', label: 'Pharmacy' },
      { category: 'beauty', label: 'Beauty' },
      { category: 'baby', label: 'Baby' },
      { category: 'household', label: 'Home Goods' },
      { category: 'snacks', label: 'Snacks' }
    ]
  },
  {
    id: 'us-trader-joes',
    label: 'Trader Joe’s',
    region: 'US',
    aisles: [
      { category: 'produce', label: 'Produce' },
      { category: 'dairy', label: 'Dairy' },
      { category: 'frozen', label: 'Frozen' },
      { category: 'pantry', label: 'Pantry' },
      { category: 'snacks', label: 'Snacks' },
      { category: 'beverages', label: 'Beverages' },
      { category: 'household', label: 'Household' }
    ]
  }
];

export function defaultAisleOrderFor(storeId: string | null | undefined): string[] | null {
  if (!storeId) {
    return null;
  }
  const store = stores.find((entry) => entry.id === storeId);
  if (!store) {
    return null;
  }
  return store.aisles.map((aisle) => aisle.category);
}

export function storeSuggestionsFor(region?: string | null) {
  if (!region) {
    return stores;
  }
  return stores.filter((store) => store.region === region);
}
