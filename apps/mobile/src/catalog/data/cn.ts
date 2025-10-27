import type { CatalogBundle } from '../types';

export const chinaCatalog: CatalogBundle = {
  region: 'CN',
  version: '2025.04.01',
  updatedAt: Date.UTC(2025, 3, 1),
  products: [
    {
      name: '豆浆粉 Soy Milk Powder',
      category: 'pantry',
      brand: '维维',
      sizeValue: 400,
      sizeUnit: 'g',
      tags: ['soy', 'breakfast'],
      prices: [
        { store: '天猫超市', unitPrice: 26.9, currency: 'CNY' }
      ]
    },
    {
      name: '阳澄湖大闸蟹',
      category: 'meat_seafood',
      brand: null,
      variant: 'Fresh',
      tags: ['crab', 'seasonal'],
      prices: [
        { store: '京东生鲜', unitPrice: 138, currency: 'CNY' }
      ]
    },
    {
      name: '日清合味道杯面',
      category: 'pantry',
      brand: '日清',
      variant: '海鲜味',
      sizeValue: 1,
      sizeUnit: 'cup',
      tags: ['instant noodle'],
      prices: [
        { store: '7-Eleven', unitPrice: 6.5, currency: 'CNY' }
      ]
    }
  ]
};
