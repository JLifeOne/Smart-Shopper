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
    },
    {
      name: 'Coconut Milk Unsweetened',
      category: 'pantry',
      brand: 'Thai Kitchen',
      sizeValue: 13.5,
      sizeUnit: 'fl_oz',
      tags: ['coconut milk'],
      prices: [
        { store: 'Trader Joe\'s', unitPrice: 3.29, currency: 'USD' }
      ]
    },
    {
      name: 'Baby Spinach',
      category: 'produce',
      sizeValue: 10,
      sizeUnit: 'oz',
      tags: ['greens', 'spinach'],
      prices: [
        { store: 'Whole Foods', unitPrice: 4.49, currency: 'USD' }
      ]
    },
    {
      name: 'Boneless Skinless Chicken Breast',
      category: 'meat_seafood',
      sizeValue: 1,
      sizeUnit: 'lb',
      tags: ['chicken'],
      prices: [
        { store: 'Whole Foods', unitPrice: 6.49, currency: 'USD' }
      ]
    },
    {
      name: 'Atlantic Salmon Filet',
      category: 'meat_seafood',
      sizeValue: 1,
      sizeUnit: 'lb',
      tags: ['salmon'],
      prices: [
        { store: 'Whole Foods', unitPrice: 12.99, currency: 'USD' }
      ]
    },
    {
      name: 'Everything Bagels',
      category: 'bakery',
      brand: 'Trader Joe\'s',
      sizeValue: 6,
      sizeUnit: 'ct',
      tags: ['bagel'],
      prices: [
        { store: 'Trader Joe\'s', unitPrice: 2.99, currency: 'USD' }
      ]
    },
    {
      name: 'Brown Basmati Rice',
      category: 'pantry',
      brand: 'Lundberg',
      sizeValue: 32,
      sizeUnit: 'oz',
      tags: ['rice', 'whole grain'],
      prices: [
        { store: 'Whole Foods', unitPrice: 5.79, currency: 'USD' }
      ]
    },
    {
      name: 'Sparkling Mineral Water',
      category: 'beverages',
      brand: 'San Pellegrino',
      sizeValue: 25.3,
      sizeUnit: 'fl_oz',
      tags: ['sparkling water'],
      prices: [
        { store: 'Trader Joe\'s', unitPrice: 2.49, currency: 'USD' }
      ]
    },
    {
      name: 'Almond Butter',
      category: 'pantry',
      brand: 'Trader Joe\'s',
      sizeValue: 16,
      sizeUnit: 'oz',
      tags: ['nut butter'],
      prices: [
        { store: 'Trader Joe\'s', unitPrice: 6.99, currency: 'USD' }
      ]
    },
    {
      name: 'Greek Yogurt Plain',
      category: 'dairy',
      brand: 'Fage',
      sizeValue: 32,
      sizeUnit: 'oz',
      tags: ['yogurt'],
      prices: [
        { store: 'Whole Foods', unitPrice: 6.49, currency: 'USD' }
      ]
    }
  ]
};
