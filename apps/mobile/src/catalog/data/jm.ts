import type { CatalogBundle } from '../types';

export const jamaicaCatalog: CatalogBundle = {
  region: 'JM',
  version: '2025.04.01',
  updatedAt: Date.UTC(2025, 3, 1),
  products: [
    {
      name: 'Bulla',
      variant: 'Ginger',
      brand: 'National',
      category: 'bakery',
      sizeValue: 1,
      sizeUnit: 'pack',
      tags: ['bulla', 'ginger', 'jamaican'],
      sourceUrl: 'https://www.nationalbakery.com/',
      prices: [
        { store: 'MegaMart', unitPrice: 360, currency: 'JMD' },
        { store: 'Hi-Lo', unitPrice: 340, currency: 'JMD' }
      ]
    },
    {
      name: 'Bulla',
      variant: 'Pineapple',
      brand: 'National',
      category: 'bakery',
      sizeValue: 1,
      sizeUnit: 'pack',
      tags: ['bulla', 'pineapple', 'jamaican'],
      prices: [
        { store: 'Progressive', unitPrice: 355, currency: 'JMD' }
      ]
    },
    {
      name: 'Grace Coconut Milk',
      category: 'pantry',
      brand: 'Grace',
      sizeValue: 400,
      sizeUnit: 'ml',
      tags: ['coconut milk', 'tinned'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 270, currency: 'JMD' }
      ]
    }
  ]
};
