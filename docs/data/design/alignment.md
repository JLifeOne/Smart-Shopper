# Smart Shopper – Design Alignment (v0.1)

> Working agreement: Before making changes, review `docs/proper-implementation.md` (Proper Implementation Protocol). Follow it throughout design and build.

## Visual Direction

### Palette
Take cues from the inspiration shots: soft neutrals with vibrant accents. Suggested base palette aligned with existing theme tokens:
- **Primary Ink**: `#0C1D37` (already in theme)
- **Background**: `#F5F7FA` (light haze)
- **Card Surface**: `#FFFFFF` with subtle shadow
- **Accent Gradient**: `#4FD1C5 → #E94EFF` for FAB and interactive states
- **Secondary Accent**: `#FF9F43` (cta highlight / warning)
- **Success**: `#38A169` (list completion)
- **Promo Highlight**: `#3182CE` with low-opacity background for info banners

### Iconography
- Use rounded, thin-stroke icons similar to Fluent/Line style to keep interface modern.
- Recommended sets: `@expo/vector-icons/Ionicons` + custom line icons for categories.
- Maintain consistent stroke width (1.5–2pt) and color theming:
  - Default icons: `#6C7A91`
  - Active tab icon: accent gradient or solid accent.
  - FAB icon (`+`): white or gradient fill, drop shadow.

### Typography
- Keep Inter as primary font. We can add weight variations for headers.
- Heading sizes: H1 28px, H2 22px, H3 18px
- Body: 16px, caption 14px, microcopy 12px with letter-spacing for uppercase tags.

### Motion & Interactions
- Use 200–250ms easing for bottom sheet slides and nav transitions (cubic-bezier(0.25, 0.1, 0.25, 1.0)).
- Add small-scale bounce on FAB press (Reanimated, scale 0.95 → 1.02 → 1).
- For top-right drawer, animate from opacity 0 → 1 + translateY(-10 → 0) to feel lightweight.
- Provide subtle drop shadows (elevation 8) for floating elements (navbar, create modal).

### Component Notes
- **Bottom Nav**: apply glass effect (blur 16, background rgba(255,255,255,0.7)), pill shape, floating 12px above bottom.
- **Cards**: corner radius 24 for hero analytics, 16 for list sections.
- **Promos Placeholder**: use illustration with accent gradient overlay + “Under Construction” chip.
- **Heatmap**: adopt squircle tiles with gradient fill representing intensity.

### Accessibility
- Maintain contrast ratio ≥ 4.5:1 for text vs background.
- Provide haptics on key actions (toggle, add item, move to completed).

## References
- Inspiration images attached in ticket #UI-001.
- Keep theme tokens defined in `packages/theme` but extend with gradients for FAB, nav.

---
This document will guide subsequent UI implementation and can be refined with designers before build.
