import http from "k6/http";
import { check, sleep } from "k6";

const vus = Number(__ENV.MENUS_LLM_VUS ?? "5");
const duration = __ENV.MENUS_LLM_DURATION ?? "30s";

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"]
  }
};

const baseUrl = __ENV.SUPABASE_URL;
const jwt = __ENV.SUPABASE_JWT;
const dishes = JSON.parse(__ENV.MENUS_LLM_DISHES ?? '["Jerk chicken", "Rice and peas"]');
const peopleCount = Number(__ENV.MENUS_LLM_PEOPLE ?? "4");
const isPremium = (__ENV.MENUS_LLM_IS_PREMIUM ?? "false").toLowerCase() === "true";
const sessionId = __ENV.MENUS_LLM_SESSION_ID ?? null;

if (!baseUrl || !jwt) {
  throw new Error("SUPABASE_URL and SUPABASE_JWT are required.");
}

export default function () {
  const url = `${baseUrl}/functions/v1/menus-llm`;
  const idempotencyKey = `menus-llm-${__VU}-${__ITER}-${Date.now()}`;
  const correlationId = `menus-llm-${__VU}-${__ITER}`;
  const payload = {
    ...(sessionId ? { sessionId } : {}),
    peopleCount,
    dishes: dishes.map((title) => ({ title })),
    preferences: {},
    policy: { isPremium, blurRecipes: false }
  };

  const res = http.post(url, JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "Idempotency-Key": idempotencyKey,
      "x-correlation-id": correlationId
    }
  });

  check(res, {
    "status is 200": (r) => r.status === 200
  });

  sleep(1);
}
