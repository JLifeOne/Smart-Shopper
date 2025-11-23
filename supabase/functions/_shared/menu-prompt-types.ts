import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const menuPromptDishSchema = z.object({
  title: z.string().min(1, 'title_required'),
  cuisineStyle: z.string().optional(),
  lockScope: z.boolean().optional(),
  notes: z.string().optional()
});

export const menuPromptInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  locale: z.string().min(2).optional(),
  peopleCount: z.number().int().min(1).default(1),
  dishes: z.array(menuPromptDishSchema).min(1, 'dishes_required'),
  preferences: z
    .object({
      dietaryTags: z.array(z.string()).optional(),
      allergenFlags: z.array(z.string()).optional()
    })
    .optional(),
  policy: z
    .object({
      isPremium: z.boolean().default(false),
      blurRecipes: z.boolean().default(true)
    })
    .optional()
});

export type MenuPromptInput = z.infer<typeof menuPromptInputSchema>;

export const menuPromptIngredientSchema = z.object({
  name: z.string(),
  quantity: z.union([z.number(), z.string()]).optional(),
  unit: z.string().optional().nullable(),
  notes: z.string().optional()
});

export const menuPromptMethodStepSchema = z.object({
  step: z.number().int().min(1),
  text: z.string()
});

export const menuPromptListLineSchema = z.object({
  name: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const menuPromptCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  course: z.string(),
  cuisine_style: z.string().optional().nullable(),
  servings: z.object({
    people_count: z.number().int().min(1),
    portion_size_per_person: z.string().optional().nullable(),
    scale_factor: z.number().optional().nullable()
  }),
  lock_scope: z.boolean().default(false),
  ingredients: z.array(menuPromptIngredientSchema),
  method: z.array(menuPromptMethodStepSchema),
  total_time_minutes: z.number().int().nonnegative().optional().default(30),
  tips: z.array(z.string()).optional(),
  list_lines: z.array(menuPromptListLineSchema),
  packaging_guidance: z.array(z.string()).optional(),
  summary_footer: z.string()
});

export const menuPromptResponseSchema = z.object({
  cards: z.array(menuPromptCardSchema),
  consolidated_list: z.array(menuPromptListLineSchema),
  menus: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        dishes: z.array(z.string()),
        list_lines: z.array(menuPromptListLineSchema).optional()
      })
    )
    .optional(),
  clarification_needed: z
    .array(
      z.object({
        dishKey: z.string(),
        question: z.string()
      })
    )
    .optional()
});

export type MenuPromptResponse = z.infer<typeof menuPromptResponseSchema>;
