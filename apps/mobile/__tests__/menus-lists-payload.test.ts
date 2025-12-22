import { describe, expect, it } from 'vitest';
import { buildMenuListConversionBody } from '../src/features/menus/api';

describe('menu list conversion payload', () => {
  it('omits peopleCountOverride when null', () => {
    const payload = buildMenuListConversionBody({
      dishIds: ['a', 'b'],
      peopleCountOverride: null,
      persistList: true,
      listName: 'Menu plan'
    }) as Record<string, unknown>;

    expect(payload).toEqual({
      dishIds: ['a', 'b'],
      persistList: true,
      listName: 'Menu plan'
    });
    expect(Object.prototype.hasOwnProperty.call(payload, 'peopleCountOverride')).toBe(false);
  });

  it('includes peopleCountOverride when numeric', () => {
    const payload = buildMenuListConversionBody({
      dishIds: ['a'],
      peopleCountOverride: 4
    }) as Record<string, unknown>;

    expect(payload.peopleCountOverride).toBe(4);
  });
});

