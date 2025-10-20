import { describe, expect, it } from 'vitest';
import { Card, PrimaryButton } from '../index';

describe('ui exports', () => {
  it('provides a Card component', () => {
    expect(typeof Card).toBe('function');
  });

  it('provides a PrimaryButton component', () => {
    expect(typeof PrimaryButton).toBe('function');
  });
});
