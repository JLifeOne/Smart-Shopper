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
    },
    {
      name: '上海青 (Bok Choy)',
      category: 'produce',
      sizeValue: 500,
      sizeUnit: 'g',
      tags: ['greens', 'bok choy'],
      prices: [
        { store: '盒马鲜生', unitPrice: 9.9, currency: 'CNY' }
      ]
    },
    {
      name: '火龙果 Dragon Fruit',
      category: 'produce',
      sizeValue: 1,
      sizeUnit: 'ct',
      tags: ['fruit'],
      prices: [
        { store: '盒马鲜生', unitPrice: 12.8, currency: 'CNY' }
      ]
    },
    {
      name: '茉莉香米',
      category: 'pantry',
      sizeValue: 5,
      sizeUnit: 'kg',
      tags: ['rice', 'jasmine'],
      prices: [
        { store: '家乐福', unitPrice: 78, currency: 'CNY' }
      ]
    },
    {
      name: '大豆油 Soybean Oil',
      category: 'pantry',
      sizeValue: 4,
      sizeUnit: 'l',
      tags: ['cooking oil'],
      prices: [
        { store: '沃尔玛', unitPrice: 65, currency: 'CNY' }
      ]
    },
    {
      name: '速冻水饺 Frozen Dumplings',
      category: 'frozen',
      brand: '湾仔码头',
      sizeValue: 900,
      sizeUnit: 'g',
      tags: ['dumplings'],
      prices: [
        { store: '盒马鲜生', unitPrice: 32, currency: 'CNY' }
      ]
    },
    {
      name: '常温奶 UHT Milk',
      category: 'dairy',
      sizeValue: 250,
      sizeUnit: 'ml',
      tags: ['milk'],
      prices: [
        { store: '家乐福', unitPrice: 4.5, currency: 'CNY' }
      ]
    },
    {
      name: '老干妈辣酱',
      category: 'pantry',
      sizeValue: 210,
      sizeUnit: 'g',
      tags: ['chili crisp'],
      prices: [
        { store: '沃尔玛', unitPrice: 16.8, currency: 'CNY' }
      ]
    },
    {
      name: '龙井绿茶',
      category: 'beverages',
      sizeValue: 250,
      sizeUnit: 'g',
      tags: ['tea'],
      prices: [
        { store: '盒马鲜生', unitPrice: 58, currency: 'CNY' }
      ]
    }
  ]
};
