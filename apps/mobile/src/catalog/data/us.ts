import type { CatalogBundle } from '../types';

export const unitedStatesCatalog: CatalogBundle = {
  region: 'US',
  version: '2025.04.01',
  updatedAt: Date.UTC(2025, 3, 1),
  products: [
    {
      name: 'Organic Gala Apples',
      category: 'produce',
      brand: null,
      variant: 'Gala',
      sizeValue: 3,
      sizeUnit: 'lb bag',
      tags: ['apple', 'organic', 'fruit'],
      prices: [
        { store: 'Whole Foods', unitPrice: 6.99, currency: 'USD' },
        { store: 'Trader Joe\'s', unitPrice: 5.99, currency: 'USD' }
      ]
    },
    {
      name: 'Oatly Oat Milk',
      category: 'dairy',
      brand: 'Oatly',
      variant: 'Original',
      sizeValue: 64,
      sizeUnit: 'oz',
      tags: ['plant-based', 'oat milk'],
      prices: [
        { store: 'Target', unitPrice: 5.49, currency: 'USD' }
      ]
    },
    {
      name: 'Sourdough Bread',
      category: 'bakery',
      brand: 'Acme',
      sizeValue: 1,
      sizeUnit: 'loaf',
      tags: ['bread', 'sourdough'],
      prices: [
        { store: 'Safeway', unitPrice: 4.99, currency: 'USD' }
      ]
    }
  ]
};
