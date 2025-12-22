/**
 * DOB helpers used by Profile Setup + Account Settings.
 *
 * We keep a strict storage format (`YYYY-MM-DD`) for durability:
 * - stable across locales (no `MM/DD/YYYY` ambiguity),
 * - easy to validate server-side,
 * - safe to use in analytics/exports.
 *
 * UI convenience: accept free-form typing/paste and normalize it as the user types.
 */

export type ParsedDob = {
  normalized: string;
  age: number;
};

/**
 * Formats arbitrary user input into a partial/complete ISO date string: `YYYY-MM-DD`.
 *
 * Intended for controlled `TextInput` usage:
 * - strips non-digits (so `1990/12/16` and `1990-12-16` both work)
 * - limits to 8 digits
 * - inserts `-` after year and month when present
 */
export function formatDobInput(value: string): string {
  const digitsOnly = value.replace(/[^\d]/g, '').slice(0, 8);
  const year = digitsOnly.slice(0, 4);
  const month = digitsOnly.slice(4, 6);
  const day = digitsOnly.slice(6, 8);

  let out = year;
  if (month.length) {
    out += `-${month}`;
  }
  if (day.length) {
    out += `-${day}`;
  }
  return out;
}

/**
 * Parses a `YYYY-MM-DD` date of birth and returns normalized ISO format + age.
 *
 * Notes:
 * - Uses UTC semantics to avoid timezone off-by-one issues.
 * - Rejects future dates and suspicious ages.
 * - Rejects invalid calendar dates (e.g. 1990-02-31).
 */
export function parseDob(dobRaw: string): ParsedDob | null {
  const trimmed = dobRaw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [year, month, day] = trimmed.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  const monthIndex = month - 1;
  const reconstructed = new Date(Date.UTC(year, monthIndex, day));
  if (
    reconstructed.getUTCFullYear() !== year ||
    reconstructed.getUTCMonth() !== monthIndex ||
    reconstructed.getUTCDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  const earliest = new Date('1900-01-01T00:00:00.000Z');
  if (reconstructed < earliest || reconstructed > now) {
    return null;
  }

  let age = now.getUTCFullYear() - year;
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > monthIndex || (now.getUTCMonth() === monthIndex && now.getUTCDate() >= day);
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  if (age < 0 || age > 130) {
    return null;
  }

  return { normalized: trimmed, age };
}
