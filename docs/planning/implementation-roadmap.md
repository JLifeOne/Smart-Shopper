# Implementation Roadmap – Smart Shopper UX Upgrade (Phase A slices)

| Sprint | Ticket ID | Title | Summary | Dependencies |
| ------ | --------- | ----- | ------- | ------------ |
| 1 | UX-001 | Bottom Nav Scaffold | Implement TabNavigator with new layout (Home, Search, Create, Promos, Receipts). Keep existing home stack. Feature-flag the nav shell (`feature_new_nav`). | Alignment doc |
| 1 | UX-002 | Top Drawer & Header Refresh | Replace home header with avatar, welcome copy, top-right menu button triggering animated drawer (Settings, Receipts, Help). | UX-001 |
| 1 | UX-003 | Promos Placeholder Screen | Add Promos tab screen with “Under Construction” hero, suggestions CTA. | UX-001 |
| 1 | UX-004 | Receipts Tab (stub) | List stored receipts with placeholder data, link to existing receipts data models. | UX-001, data models |
| 2 | LIST-001 | Create Modal (text input) | Center FAB opens bottom sheet with multi-line text input and chips for Type/Voice/Camera (only Type active). Feature flag `feature_create_workflow`. | UX-001 |
| 2 | LIST-002 | Category Inference Service | Implement dictionary-based categorization function (Supabase edge + local fallback). | LIST-001 |
| 2 | LIST-003 | Categorized List View | Render grouped items by category, tap-to-complete or optional checkbox (settings). Completed items move based on preference. | LIST-001, LIST-002 |
| 3 | LIST-004 | Voice Input Integration | Hook Voice tab into create modal using Expo speech recognition. Append transcript to input. | LIST-001 |
| 3 | LIST-005 | Camera OCR | Capture image via Expo Camera, send to OCR service, preview, merge items. | LIST-001 |
| 3 | LIST-006 | Settings Toggles | Create Settings screen (under drawer) with options: use checkboxes, completed item position, strike style. | UX-002, LIST-003 |
| 4 | HOME-001 | Home Analytics Zone | Replace quick stats card with analytics cards (heatmap mini, spending vs budget stub, promos summary). | UX-001, data stubs |
| 4 | HOME-002 | Heatmap Component | Build heatmap visualization (static data for now). | HOME-001 |
| 4 | HOME-003 | Suggestions Module | Add “Suggested items” chips based on history (initial static suggestions). | LIST-003 |
| 5 | RCPT-001 | Receipts Detail Page | Show parsed line items, preview, `+ Add data` button to manually add price/qty/etc. | UX-004 |
| 5 | RCPT-002 | Manual Data Entry UI | Modal for price/quantity/weight/store manual entry. | RCPT-001 |
| 5 | RCPT-003 | Store Tab "Receipts" integration | Connect receipts tab to actual Supabase data and manual entries. | RCPT-002 |
| 6 | POLISH-001 | Animations & Haptics | Add Reanimated transitions, haptic feedback on key actions. | Prior tickets |
| 6 | POLISH-002 | Feature Flag Cleanup | Prepare flags for release toggles, logs, and fallback path. | All |

### Feature Flags
- `feature_new_nav` – controls the bottom navigation + header redesign (default off until QA).
- `feature_create_workflow` – controls new create modal & categorized list.
- Future: `feature_promos_tab`, `feature_receipts_tab` if incremental rollout needed.

### Notes
- Tickets map to PRD Phase A, enabling incremental, safe rollout.
- Ensure each sprint deliverable keeps current experience intact by default (flags off).
- Add QA tasks per sprint for regression testing (list creation, auth, navigation).
