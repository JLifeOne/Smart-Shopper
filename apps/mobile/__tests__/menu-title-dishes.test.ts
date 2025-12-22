import { describe, expect, it } from 'vitest';
import { menuTitleDishIdempotencyKey } from '../src/features/menus/api';

describe('menu title-only idempotency keys', () => {
  it('produces stable keys for the same title/date', () => {
    expect(menuTitleDishIdempotencyKey({ title: 'Ackee and saltfish', createdDate: '2025-01-01' })).toBe(
      menuTitleDishIdempotencyKey({ title: 'Ackee and saltfish', createdDate: '2025-01-01' })
    );
  });

  it('varies by date and title', () => {
    expect(menuTitleDishIdempotencyKey({ title: 'Ackee and saltfish', createdDate: '2025-01-01' })).not.toBe(
      menuTitleDishIdempotencyKey({ title: 'Ackee and saltfish', createdDate: '2025-01-02' })
    );
    expect(menuTitleDishIdempotencyKey({ title: 'Ackee and saltfish', createdDate: '2025-01-01' })).not.toBe(
      menuTitleDishIdempotencyKey({ title: 'Callaloo', createdDate: '2025-01-01' })
    );
  });

  it('stays within header length constraints', () => {
    const longTitle = 'A'.repeat(500);
    const key = menuTitleDishIdempotencyKey({ title: longTitle, createdDate: '2025-01-01' });
    expect(key.length).toBeLessThanOrEqual(255);
  });
});

