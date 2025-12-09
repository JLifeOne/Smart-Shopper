# QA Feature Flags

| Flag | Default | Scope | QA Guidance |
| --- | --- | --- | --- |
| `feature_heatmap_v2` | `true` (dev) | Home analytics | Toggle off to compare legacy heatmap grid vs. new monthly calendar. |
| `feature_theme_selection` | `false` | Settings → Personalization | Enable when validating dynamic palettes; verify contrast under light/dark modes. |
| `feature_list_parser_v2` | `false` | Create list flow | Turn on to exercise Python parsing + AI recommendations; capture parsing accuracy metrics. |
| `feature_list_sharing` | `false` | List detail CTA | Enable to surface “Share list” CTA and deep-link landing page, then test install/no-install scenarios. |
| `feature_ai_suggestions` | `false` | Suggestions row, autocomplete | Enable after recommendation service is reachable; verify toggles in Settings → Personalization. |
| `feature_menu_dev_full_access` | `false` | Menus (dev only) | Use in local/dev builds to unlock premium menu flows for testing; do not enable in production. |

Flags are sourced from Expo public env vars (see `apps/mobile/.env`) and consumed via `featureFlags` in the mobile app. Update Supabase remote config before widening rollouts.
