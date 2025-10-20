# Smart Shopper Mobile Design Spec

## 1. Design Tokens

| Token | Value | Notes |
| --- | --- | --- |
| `color.brand.primary` | `#4FD1C5` | Core accent, buttons, active icons |
| `color.brand.secondary` | `#0C1D37` | Dark text, cards |
| `color.surface.default` | `#FFFFFF` | Card background |
| `color.surface.alt` | `#F4F7FB` | Dashboard background |
| `color.text.primary` | `#0C1D37` | Primary copy |
| `color.text.secondary` | `#4A576D` | Supporting copy |
| `color.text.muted` | `#6C7A91` | Captions, helper text |
| `color.success` | `#38A169` | Positive trends |
| `color.warning` | `#D97706` | Warnings |
| `color.error` | `#DC2626` | Errors |
| `radius.xs` | `8` | Chips |
| `radius.sm` | `12` | Buttons |
| `radius.md` | `20` | Cards |
| `radius.lg` | `28` | Sheets, modals |
| `shadow.soft` | `{color: '#101828', opacity: 0.08, radius: 18}` | Card lift |
| `spacing.xs` | `4` | System spacing |
| `spacing.sm` | `8` |  |
| `spacing.md` | `12` |  |
| `spacing.lg` | `16` |  |
| `spacing.xl` | `24` |  |
| `font.display` | `Poppins 700` | Hero counts, large titles |
| `font.title` | `Poppins 600` | Card titles |
| `font.body` | `Inter 500` | Primary copy |
| `font.caption` | `Inter 400` | Supporting copy |

## 2. Component Anatomy

### Top Bar
1. Logo badge (left) with gradient pill and wordmark.
2. Spacer flex.
3. Profile avatar (tap opens profile sheet).
4. Menu trigger (ellipsis) opening top-right modal.

### Stat Card
1. Icon chip.
2. Header label (caption).
3. Primary value (display font).
4. Delta pill (optional +/−).
5. Divider (optional).
6. Secondary metric rows.

### Trend Card
1. Title + segmented control (Daily/Weekly/Monthly).
2. Chart area (line/bar/heatmap).
3. Tooltip strip (value + timestamp).
4. CTA (e.g., “View reports”).

### List Row
1. Thumbnail (product image or placeholder).
2. Title + supporting detail (store, last purchase).
3. Tag cluster (e.g., “Low stock”, “Sale”).
4. Trailing metric (price/qty) or action (share).

### Primary Button
1. Full-width rounded pill.
2. Gradient background (brand primary -> lighter tone).
3. Label (uppercase) + optional icon.

### Sign-Up Stepper
1. Progress dots (1–4).
2. Step hero icon.
3. Form stack (inputs, pickers).
4. Next CTA / Secondary CTA (e.g., “Use email instead”).

## 3. Sample Screens

### Home Dashboard
- Background gradient header with greeting.
- Top strip: `StatCard` trio (Spend, Savings, Receipts).
- Middle carousel: `TrendCard` (Heatmap, Price drops, Top stores).
- Bottom section: `Next Actions` list and `Suggested Additions` chips powered by recommendations service.

### Analytics Overview
- Tab bar for `Overview`, `Inventory`, `Price History`.
- Sectioned layout: KPI band, chart grid (line chart, stacked bars, donut), table cards for top items.
- Filters anchored under top bar (time range, store).

### Sign-Up Wizard
1. Step 1 – Phone number: country selector, formatted number field, “Send code”.
2. Step 2 – Region: map preview + city input.
3. Step 3 – Profile: avatar picker, display name, optional household toggle.
4. Step 4 – OTP: 6-digit input, resend timer, success animation -> home.

### Shared List Preview (Web & In-App)
- Card stack summarising list metadata (owner, items, last updated).
- Item table (name, qty, note) with CTA “Open in Smart Shopper”.
- For non-installed: store links; for installed: deep link to list detail behind `feature_list_sharing`.

## 4. Motion & Interaction
- Screen transitions follow Expo Router defaults with ease-in-out.
- Cards ease in from 16px offset, 250ms, slight overshoot.
- Charts animate values on data refresh; maintain scroll position via `Animated.ScrollView` with `maintainVisibleContentPosition`.
- Menu modal fades the background to 45% brand dark.

## 5. Accessibility
- Minimum color contrast 4.5:1 for text/cards.
- Tap targets ≥ 44x44.
- OTP input supports paste and accessible label per field.
- VoiceOver order: Logo → Greeting → Stats → Charts → Actions.

## 6. Feature Flags & QA
- `feature_heatmap_v2`: enable live monthly heatmap + analytics cards.
- `feature_theme_selection`: surface theme picker in Settings → Personalization.
- `feature_ai_suggestions`: toggle AI-powered item recommendations and autocompletions.
- `feature_list_sharing`: expose share CTA and app-link landing page.
- `feature_list_parser_v2`: enable Python parsing service pipeline for quantities/brands.

Document owner: Mobile Platform team. Update quarterly or when new palette/components ship.
