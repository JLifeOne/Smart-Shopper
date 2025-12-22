import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDobInput, parseDob } from '../src/lib/dob';

describe('dob helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats arbitrary user input into YYYY-MM-DD', () => {
    expect(formatDobInput('19901216')).toBe('1990-12-16');
    expect(formatDobInput('1990/12/16')).toBe('1990-12-16');
    expect(formatDobInput('1990-12-16')).toBe('1990-12-16');
    expect(formatDobInput('1990 12 16')).toBe('1990-12-16');
  });

  it('formats partial input without padding', () => {
    expect(formatDobInput('')).toBe('');
    expect(formatDobInput('1990')).toBe('1990');
    expect(formatDobInput('19901')).toBe('1990-1');
    expect(formatDobInput('199012')).toBe('1990-12');
    expect(formatDobInput('1990121')).toBe('1990-12-1');
  });

  it('parses valid ISO DOB and computes age (UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    expect(parseDob('1990-12-16')).toEqual({ normalized: '1990-12-16', age: 34 });
  });

  it('rejects invalid or out-of-range DOB values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    expect(parseDob('1990/12/16')).toBeNull();
    expect(parseDob('1990-2-3')).toBeNull();
    expect(parseDob('1990-02-31')).toBeNull();
    expect(parseDob('1899-12-31')).toBeNull();
    expect(parseDob('2025-01-02')).toBeNull();
  });
});

