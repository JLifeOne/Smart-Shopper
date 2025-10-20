import { describe, expect, it } from 'vitest';

describe('environment configuration', () => {
  it('defines Supabase public env keys', () => {
    expect(process.env.EXPO_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });
});
