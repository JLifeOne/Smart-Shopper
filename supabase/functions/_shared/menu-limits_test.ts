import { assertEquals } from "https://deno.land/std@0.207.0/testing/asserts.ts";
import { buildMenuLimits } from "./menu-limits.ts";

Deno.test("buildMenuLimits returns premium defaults", () => {
  assertEquals(buildMenuLimits({ isPremium: true }), {
    maxUploadsPerDay: 10,
    concurrentSessions: 5,
    maxListCreates: 10,
    limitWindow: "day"
  });
});

Deno.test("buildMenuLimits returns freemium defaults", () => {
  assertEquals(buildMenuLimits({ isPremium: false }), {
    maxUploadsPerDay: 3,
    concurrentSessions: 1,
    maxListCreates: 3,
    limitWindow: "lifetime"
  });
});
