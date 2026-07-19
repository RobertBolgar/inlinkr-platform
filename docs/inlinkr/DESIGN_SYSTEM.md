# InLinkr Design System

## Brand Philosophy

InLinkr is a calm, precise workspace for creators. The interface is dark, direct, and intentionally restrained: information leads, actions are obvious, and the brand orange is reserved for moments that need emphasis.

## Foundations

### Color Palette

| Semantic token | CSS variable | Tailwind class | Role |
| --- | --- | --- | --- |
| Background | `--il-bg` | `bg-background` | Application canvas |
| Surface | `--il-surface` | `bg-surface` | Cards, navigation, dialogs |
| Surface elevated | `--il-surface-elevated` | `bg-surface-elevated` | Raised controls and hover surfaces |
| Surface hover | `--il-surface-hover` | `bg-surface-hover` | Hover states |
| Border | `--il-border` | `border-border` | Dividers and control outlines |
| Primary text | `--il-text` | `text-text` | Headings and primary content |
| Muted text | `--il-text-muted` | `text-text-muted` | Supporting copy and metadata |
| Subtle text | `--il-text-subtle` | `text-text-subtle` | Disabled or hint text |
| Primary | `--il-primary` | `bg-primary`, `text-primary`, `border-primary` | Primary actions, active navigation, selection |
| Primary hover | `--il-primary-hover` | `bg-primary-hover` | Primary action hover state |
| Primary strong | `--il-primary-strong` | `bg-primary-strong` | Darker primary variant |
| Info | `--il-info` | `bg-info`, `text-info` | Informational surfaces and charts |
| Success | `--il-success` | `bg-success`, `text-success` | Positive status and completed work |
| Warning | `--il-warning` | `bg-warning`, `text-warning` | Cautionary states |
| Danger | `--il-danger` | `bg-danger`, `text-danger` | Destructive and error states |

Raw values live in `src/styles/tokens.css`. `tailwind.config.js` exposes those values through the semantic Tailwind color names above. Shared UI primitives use those semantic names. Page-level code should compose with the shared primitives and the same semantic utilities; do not introduce new hard-coded color hexes.

### Typography

- Use the system sans-serif stack for fast, crisp UI rendering.
- Page titles use bold `text-2xl` on desktop and retain a clear hierarchy on mobile.
- Section labels use uppercase, tracked `text-xs` labels.
- Supporting copy should default to `text-sm`; avoid `text-[10px]` except compact data labels and badges.
- Prefer `font-medium` for actions and `font-semibold` for headings or key values.

### Spacing

| Scale | Value | Use |
| --- | --- | --- |
| 1 | 4px | Icon and inline gaps |
| 2 | 8px | Compact control spacing |
| 3 | 12px | Card internals |
| 4 | 16px | Standard card padding |
| 5 | 20px | Section spacing |
| 6 | 24px | Page section spacing |
| 8 | 32px | Major visual separation |

### Radius and Shadows

- Controls: `rounded-lg`.
- Cards and dialogs: `rounded-xl`.
- Pills and compact status elements: `rounded-full`.
- Use subtle shadows only for floating navigation, modals, menus, and toast feedback.

## Components

### Buttons

- **Primary:** orange background, white text, 40px minimum height.
- **Secondary:** raised neutral surface with border.
- **Ghost:** transparent with a subtle neutral hover surface.
- **Danger:** dark red surface with red border and text.
- **Disabled:** reduced opacity, no hover emphasis.
- **Loading:** preserve width and replace content with a concise loading state.

Use the shared `Button` primitive for new work.

### Cards

Use `SurfaceCard` for standard content groups. Cards use the surface background, a single neutral border, `rounded-xl`, responsive 16–20px padding, and a modest hover lift only when interactive.

### Inputs

Inputs and textareas use the canvas background, neutral border, 40px control height, readable labels, and an orange focus ring. Helper text and errors sit directly beneath the control.

### Tables and Charts

- Use surface containers with a clear border and `rounded-xl`.
- Keep table header labels compact and secondary; reserve primary text for values.
- Use orange for the primary series or selected metric, with semantic colors only for meaning.

### Icons and Badges

- Default action icons are 16px; navigation icons are 20px; primary action icons are 18–20px.
- Keep icon and label gaps at 6–8px.
- Badges use compact type, rounded controls, and semantic color only when it communicates status.

### Empty and Loading States

- Empty states are centered surface cards with a clear title, one sentence of guidance, and one primary action.
- Loading uses quiet skeleton surfaces or a small spinner; no flashing or full-screen decorative animation.

### Modals and Toasts

- Modals use a blurred dark overlay, surface card, `rounded-xl`, generous 20px padding, and a clearly separated action row.
- Toasts appear at the top center with a surface background, semantic icon, border, and subtle entrance animation.

## Navigation

- Active navigation uses the brand orange and a restrained dark orange surface.
- Inactive navigation remains secondary text and gains primary text on hover.
- Public and product navigation share the same surface, border, control height, and focus behavior.

## Motion

Use 150–200ms ease transitions for hover, focus, dropdown, and modal states. Respect `prefers-reduced-motion`; avoid large transforms, pulsing decorative visuals, and unexpected movement.

## Mobile Behavior

- Maintain 16px horizontal gutters.
- Keep controls at least 40px high and touch targets at least 44px where practical.
- Use the bottom navigation as the primary mobile wayfinding control.
- Preserve information hierarchy before reducing typography or card padding.
