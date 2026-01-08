import { assertEquals } from "https://deno.land/std@0.207.0/testing/asserts.ts";
import { formatPackagingLabel, sanitizeResponseShape } from "../_shared/menu-llm-utils.ts";

Deno.test("formatPackagingLabel scales pack size by unit conversion", () => {
  const label = formatPackagingLabel(
    { key: "flour", name: "Flour", quantity: 1000, unit: "g" },
    { pack_size: 500, pack_unit: "g", display_label: "500 g bag" }
  );
  assertEquals(label, "Buy 2 × 500 g bag of Flour");
});

Deno.test("formatPackagingLabel falls back to display label when quantities missing", () => {
  const label = formatPackagingLabel(
    { key: "beans", name: "Beans", quantity: null, unit: null },
    { pack_size: 400, pack_unit: "g", display_label: "400 g can" }
  );
  assertEquals(label, "Buy 400 g can of Beans");
});

Deno.test("sanitizeResponseShape normalizes cards and list defaults", () => {
  const raw = {
    cards: [
      {
        id: "",
        title: " ",
        course: "Main",
        cuisine_style: null,
        servings: { people_count: 2, portion_size_per_person: null, scale_factor: 1 },
        lock_scope: false,
        ingredients: [],
        method: [{ step: 3, text: "Cook." }, { step: 2, text: "Prep." }, { step: 1, text: "" }],
        total_time_minutes: 15,
        tips: [],
        list_lines: [],
        summary_footer: "ok"
      }
    ],
    consolidated_list: null
  };

  const normalized = sanitizeResponseShape(raw as any);
  assertEquals(normalized.cards[0].id, "card-1");
  assertEquals(normalized.cards[0].title, "Dish 1");
  assertEquals(normalized.cards[0].method[0].step, 1);
  assertEquals(normalized.consolidated_list, []);
});

Deno.test({
  name: "menus-llm integration (requires SUPABASE_URL + SUPABASE_JWT)",
  ignore: !(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_JWT")),
  async fn() {
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const jwt = Deno.env.get("SUPABASE_JWT")!;
    const res = await fetch(`${baseUrl}/functions/v1/menus-llm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        "Idempotency-Key": `menus-llm-test-${crypto.randomUUID()}`,
        "x-correlation-id": `menus-llm-test-${crypto.randomUUID()}`
      },
      body: JSON.stringify({
        peopleCount: 2,
        dishes: [{ title: "Curry chicken" }],
        preferences: {},
        policy: { isPremium: true, blurRecipes: false }
      })
    });
    assertEquals(res.status, 200);
  }
});
