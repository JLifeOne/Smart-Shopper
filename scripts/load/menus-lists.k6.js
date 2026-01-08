import http from "k6/http";
import { check, sleep } from "k6";

const vus = Number(__ENV.MENUS_LISTS_VUS ?? "5");
const duration = __ENV.MENUS_LISTS_DURATION ?? "30s";

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"]
  }
};

const baseUrl = __ENV.SUPABASE_URL;
const jwt = __ENV.SUPABASE_JWT;
const dishIds = (__ENV.MENUS_LISTS_DISH_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const peopleCount = Number(__ENV.MENUS_LISTS_PEOPLE ?? "4");
const persistList = (__ENV.MENUS_LISTS_PERSIST ?? "false").toLowerCase() === "true";
const listName = __ENV.MENUS_LISTS_LIST_NAME ?? "Menu load test";

if (!baseUrl || !jwt || dishIds.length === 0) {
  throw new Error("SUPABASE_URL, SUPABASE_JWT, and MENUS_LISTS_DISH_IDS are required.");
}

export default function () {
  const url = `${baseUrl}/functions/v1/menus-lists`;
  const idempotencyKey = `menus-lists-${__VU}-${__ITER}-${Date.now()}`;
  const correlationId = `menus-lists-${__VU}-${__ITER}`;
  const payload = {
    dishIds,
    peopleCountOverride: peopleCount,
    persistList,
    ...(persistList ? { listName } : {})
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
