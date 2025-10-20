import { describe, expect, it } from 'vitest';
import { theme } from '../index';

describe('theme', () => {
  it('exposes palette accent color', () => {
    expect(theme.palette.accent).toBe('#4FD1C5');
  });

  it('shares radius values across exports', () => {
    expect(theme.radius.md).toBeGreaterThan(theme.radius.sm);
  });
});
