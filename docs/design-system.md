# Notara Design System

A living reference for the visual language of Notara. All tokens live in `:root` inside `packages/app/src/styles.css` and should be the single source of truth for any new UI work.

---

## Personality

Notara is a **content-first** writing tool. The UI exists to get out of the way. The aesthetic is:

- **Light** — white content area, nothing competing with the text
- **Refined** — choices are deliberate, not decorative
- **Calm** — no aggressive colors, no jarring motion
- **Editorial** — serif titles give notes the weight of real documents

---

## Color

### Content area

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FFFFFF` | Page background |
| `--bg-editor` | `#FEFEFE` | Editor surface |
| `--surface` | `#FFFFFF` | Modals, popovers, cards |
| `--surface-2` | `#F7F8FA` | Input backgrounds, table headers |
| `--surface-3` | `#EDEEF2` | Hover fills, secondary surfaces |
| `--surface-4` | `#E3E5EC` | Active fills, pressed states |

### Sidebar

The sidebar uses a dedicated cool blue-slate palette, clearly distinct from the white content area without being harsh.

| Token | Value | Usage |
|-------|-------|-------|
| `--sb` | `#EDEEF2` | Sidebar background |
| `--sb-2` | `#E3E5EC` | Sidebar hover |
| `--sb-3` | `#D8DBE5` | Sidebar active fill, drag handles |
| `--sb-4` | `#CDD0DC` | Deeper pressed state |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text` | `#0D0F14` | Primary — headings, body copy |
| `--text-2` | `#454954` | Secondary — labels, descriptions |
| `--text-3` | `#8C909E` | Tertiary — placeholders, hints, muted labels |
| `--text-sb` | `#2C2F3A` | Sidebar primary text |
| `--text-sb-2` | `#555A6A` | Sidebar secondary text |
| `--text-sb-3` | `#9499AA` | Sidebar muted text |

### Accent — Indigo

The single accent color. Used for focus rings, active states, CTAs, and interactive indicators. Never decorative.

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#5B5EF4` | Buttons, active borders, left-bar indicator |
| `--accent-2` | `#4447E2` | Hover state on accent elements |
| `--accent-dim` | `rgba(91,94,244,0.09)` | Tinted backgrounds (selected items, focus rings) |
| `--accent-mid` | `rgba(91,94,244,0.16)` | Stronger tint (hover on already-accented items) |
| `--accent-glow` | `rgba(91,94,244,0.22)` | Drop indicators, glow shadows |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#16A34A` | Positive feedback |
| `--danger` | `#DC2626` | Destructive actions, errors |
| `--danger-dim` | `rgba(220,38,38,0.08)` | Danger hover backgrounds |
| `--warning` | `#D97706` | Warnings (not widely used yet) |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `rgba(0,0,0,0.07)` | Default hairline — dividers, card edges |
| `--border-mid` | `rgba(0,0,0,0.12)` | Elevated — modal borders, active inputs |
| `--border-sb` | `rgba(0,0,0,0.08)` | Sidebar-specific borders |

Borders are semi-transparent so they naturally adapt to their background.

---

## Typography

Two typefaces, three contexts.

### Fonts

| Variable | Family | Role |
|----------|--------|------|
| `--font-ui` | DM Sans | All UI chrome — sidebar, toolbars, labels, buttons |
| `--font-title` | Lora (serif) | Page titles, document headings, auth headings |
| `--font-mono` | JetBrains Mono | Code blocks, inline code, kbd hints |

Both are loaded from Google Fonts with `display=swap` in `styles.css`.

### Scale

| Use | Size | Weight | Notes |
|-----|------|--------|-------|
| Page title | `2.4em` | 700 | Lora, `letter-spacing: -0.025em` |
| H1 in editor | `1.82em` | 700 | Lora |
| H2 in editor | `1.38em` | 600 | Lora |
| H3 in editor | `1.14em` | 600 | Lora |
| Body / editor p | `15px` | 400 | DM Sans, `line-height: 1.75` |
| UI default | `14px` | 400 | DM Sans |
| Sidebar items | `13px` | 400/500 (selected) | DM Sans |
| Labels / section headers | `10–12px` | 600 | DM Sans, uppercase, `letter-spacing: 0.07–0.08em` |
| Mono / code | `13.5px` | 400 | JetBrains Mono, `line-height: 1.65` |

---

## Spacing & Radius

### Border radius

| Token | Value | Used for |
|-------|-------|---------|
| `--radius-sm` (implicit) | `4–5px` | Tiny elements, kbd chips |
| `6px` | — | Sidebar nodes, buttons, inputs |
| `8–10px` | — | Cards, modal inputs, popovers |
| `12–14px` | — | Modals, larger cards |
| `20px` | — | Auth card |

### Layout

- Sidebar: `200px` min-width, `480px` max, resizable
- Editor: `52px 96px` padding (top/bottom, left/right)
- Editor wide mode: `28px 52px`
- Max comfortable reading line: naturally constrained by padding — no explicit `max-width` on prose

---

## Shadows

Layered with both a spread shadow and a tight drop shadow for depth without heaviness.

| Token | Value | Used for |
|-------|-------|---------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.06)` | Selected sidebar items |
| `--shadow-sm` | `0 2px 6px … + 0 1px 2px …` | Cards on hover |
| `--shadow-md` | `0 4px 16px … + 0 2px 4px …` | Floating elements |
| `--shadow-lg` | `0 12px 32px … + 0 4px 8px …` | Popovers, dropdowns |
| `--shadow-xl` | `0 24px 56px … + 0 8px 16px …` | Modals, record panel, auth card |

Accent elements (buttons, avatars) use a colored shadow: `0 2px 10px rgba(91,94,244,0.38)`.

---

## Motion

### Easings

| Variable | Value | Character |
|----------|-------|-----------|
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard — most transitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Overshoot — modal pop-ins, empty state entrance |

### Durations

| Variable | Value | Used for |
|----------|-------|---------|
| `--t` | `0.14s` | All hover/focus state changes |
| `--t-slow` | `0.22s` | Auth card entrance |

### Keyframe animations

| Name | Description |
|------|-------------|
| `fade-in` | Overlay backdrops (opacity 0→1 over 0.12s) |
| `modal-pop` | Panel/card entrance — fade + slight downward translate + scale (0.97→1) |
| `slide-from-right` | Record side panel entrance |
| `empty-state-in` | Empty state — fade + upward translate (spring) |
| `spin` | Loading spinners |

**Principle:** one well-orchestrated entrance per UI layer. Hover transitions are fast (`0.14s`). Modals and overlays animate in once, never on repeat.

---

## Component Patterns

### Sidebar item (page node)

Three visual states:

| State | Background | Text | Detail |
|-------|-----------|------|--------|
| Default | transparent | `--text-sb-2` | — |
| Hover | `rgba(255,255,255,0.65)` — frosted glass | `--text-sb` | — |
| Selected | `rgba(255,255,255,0.85)` + `--shadow-xs` | `--text-sb` + `font-weight: 500` | Indigo 2.5px left bar |

The frosted glass hover (`rgba(255,255,255,0.65)`) lifts items off the `#EDEEF2` slate without a flat filled rectangle feel.

### Workspace avatar

Indigo gradient badge: `linear-gradient(135deg, --accent 0%, --accent-2 100%)` with a colored box-shadow. Used at two sizes: `42px` (workspace list) and `26px` (sidebar trigger).

### Buttons — primary

`background: --accent`, `border-radius: 10px`, colored box-shadow. Hover: `background: --accent-2`, shadow intensifies, `translateY(-1px)`. Active: translate resets.

### Buttons — secondary / ghost

`background: --surface-2/3`, `border: 1px solid --border`. Hover: slightly darker surface, border darkens.

### Input focus ring

`border-color: --accent` + `box-shadow: 0 0 0 3px --accent-dim`. Never just a colored border alone.

### Drop indicators (DnD)

2px `--accent` line with `box-shadow: 0 0 6px --accent-glow` — visible against any surface without animation.

### Modals / popovers

- Backdrop: `rgba(15,18,30,0.4)` + `backdrop-filter: blur(8px)`
- Card: white, `border: 1px solid --border-mid`, radius `14px`, `--shadow-xl`
- Entrance: `modal-pop` keyframe (spring)

---

## Dos and Don'ts

**Do:**
- Use `--accent` only for interactive/semantic meaning, never purely decorative
- Keep sidebar text in the `--text-sb-*` palette, not the content `--text-*` palette
- Use Lora only for page-level titles and auth headings — never for UI labels
- Add `backdrop-filter: blur` to overlays for depth
- Derive all colors from tokens — no hardcoded hex values in components

**Don't:**
- Use the dark theme tokens from the first iteration (`#0C0C0C`, terracotta `#D4915C`) — those were superseded
- Add `transition` to every property — only transition what visibly changes
- Use `box-shadow` for layout separation — use `border` or background contrast instead
- Introduce a second accent color without updating this document
