export type MenuLimitWindow = "day" | "lifetime";

export type MenuLimitsBase = {
  maxUploadsPerDay: number;
  concurrentSessions: number;
  maxListCreates: number;
  limitWindow: MenuLimitWindow;
};

const PREMIUM_LIMITS: MenuLimitsBase = {
  maxUploadsPerDay: 10,
  concurrentSessions: 5,
  maxListCreates: 10,
  limitWindow: "day"
};

const FREEMIUM_LIMITS: MenuLimitsBase = {
  maxUploadsPerDay: 3,
  concurrentSessions: 1,
  maxListCreates: 3,
  limitWindow: "lifetime"
};

export function buildMenuLimits(options: { isPremium: boolean }): MenuLimitsBase {
  // Centralized limits keep menu policy + enforcement consistent across functions.
  return options.isPremium ? { ...PREMIUM_LIMITS } : { ...FREEMIUM_LIMITS };
}
