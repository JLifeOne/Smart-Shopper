import { describe, expect, it } from 'vitest';
import { convertToBaseUnit, getUnitPrice } from '../index';

describe('pricing utilities', () => {
  it('converts grams to kilograms correctly', () => {
    const quantity = convertToBaseUnit({
      size: { unit: 'g', value: 250 },
      category: 'pantry',
      baseUnitOverride: 'kg'
    });

    expect(quantity).toBeCloseTo(0.25);
  });

  it('computes the unit price with four decimal precision', () => {
    const unitPrice = getUnitPrice({
      price: 5,
      size: { unit: 'ml', value: 500 },
      category: 'beverages'
    });

    expect(unitPrice).toBeCloseTo(0.01);
  });

  it('throws when conversion is unsupported', () => {
    expect(() =>
      convertToBaseUnit({ size: { unit: 'ct', value: 2 }, category: 'pantry', baseUnitOverride: 'ml' })
    ).toThrowError('Cannot convert ct to ml');
  });
});
