import type { CatalogBundle, CatalogRecord } from '../types';
import { westernSharedCatalog, WESTERN_SHARED_VERSION } from './western-shared';

const legacyProducts: CatalogRecord[] = [
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
      name: 'Scotch Bonnet Pepper',
      category: 'produce',
      sizeValue: 0.25,
      sizeUnit: 'kg',
      tags: ['pepper', 'hot', 'scotch bonnet'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 420, currency: 'JMD' },
        { store: 'Progressive', unitPrice: 395, currency: 'JMD' }
      ]
    },
    {
      name: 'Callaloo Bunch',
      category: 'produce',
      sizeValue: 1,
      sizeUnit: 'bunch',
      tags: ['leafy', 'callaloo'],
      prices: [
        { store: 'Coral Sea Supermarket', unitPrice: 250, currency: 'JMD' },
        { store: 'Hi-Lo', unitPrice: 260, currency: 'JMD' }
      ]
    },
    {
      name: 'Pak Choi',
      category: 'produce',
      sizeValue: 1,
      sizeUnit: 'bunch',
      tags: ['greens', 'bok choy'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 290, currency: 'JMD' }
      ]
    },
    {
      name: 'Plantain',
      category: 'produce',
      sizeValue: 1,
      sizeUnit: 'bunch',
      tags: ['plantain'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 370, currency: 'JMD' },
        { store: 'Progressive', unitPrice: 360, currency: 'JMD' }
      ]
    },
    {
      name: 'Yellow Yam',
      category: 'produce',
      sizeValue: 1,
      sizeUnit: 'kg',
      tags: ['yam'],
      prices: [
        { store: 'Coral Sea Supermarket', unitPrice: 480, currency: 'JMD' }
      ]
    },
    {
      name: 'Grace Ackee',
      brand: 'Grace',
      category: 'pantry',
      sizeValue: 1,
      sizeUnit: 'can',
      tags: ['ackee', 'tinned'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 950, currency: 'JMD' },
        { store: 'PriceSmart', unitPrice: 920, currency: 'JMD' }
      ]
    },
    {
      name: 'Grace Corned Beef',
      brand: 'Grace',
      category: 'pantry',
      sizeValue: 1,
      sizeUnit: 'can',
      tags: ['corned beef', 'bully beef'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 520, currency: 'JMD' },
        { store: 'Progressive', unitPrice: 515, currency: 'JMD' }
      ]
    },
    {
      name: 'Lasco Food Drink Vanilla',
      brand: 'Lasco',
      category: 'pantry',
      sizeValue: 400,
      sizeUnit: 'g',
      tags: ['powder drink'],
      prices: [
        { store: 'Hi-Lo', unitPrice: 430, currency: 'JMD' }
      ]
    },
    {
      name: 'Betapac Curry Powder',
      brand: 'Betapac',
      category: 'pantry',
      sizeValue: 100,
      sizeUnit: 'g',
      tags: ['curry powder'],
      prices: [
        { store: 'Coral Sea Supermarket', unitPrice: 310, currency: 'JMD' }
      ]
    },
    {
      name: 'Wata Bag Juice',
      brand: 'Wata',
      category: 'beverages',
      sizeValue: 1,
      sizeUnit: 'bottle',
      tags: ['bag juice'],
      prices: [
        { store: 'Progressive', unitPrice: 90, currency: 'JMD' }
      ]
    },
    {
      name: 'Whole Snapper',
      category: 'meat_seafood',
      sizeValue: 1,
      sizeUnit: 'kg',
      tags: ['snapper', 'fish'],
      prices: [
        { store: 'Coral Sea Supermarket', unitPrice: 1800, currency: 'JMD' }
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
  ];

export const jamaicaCatalog: CatalogBundle = {
  region: 'JM',
  version: `2025.11.10-${WESTERN_SHARED_VERSION}`,
  updatedAt: Date.UTC(2025, 10, 10),
  products: [...westernSharedCatalog.jm, ...legacyProducts]
};
