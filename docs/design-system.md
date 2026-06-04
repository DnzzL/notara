# Notara Design System

A living reference for the visual language of Notara. All tokens live in `:root` inside `packages/app/src/styles.css` and are the single source of truth for any new UI work.

---

## Personality

Notara is a **content-first** writing tool with a **Swiss / International typographic** chrome. The aesthetic:

- **Paper, not screen** — warm off-white (`#FAFAF8`), never clinical pure white
- **Ink + one signal** — near-black ink and a single electric blue. No gradients, no second accent
- **Structural** — visible grid lines, hairline rules, hard 2px section borders. Composition over decoration
- **Squared** — small radii (3–6px), flat fills. Borders carry the design, not shadows
- **Display in grotesque** — Bricolage Grotesque, tight and uppercase, gives headings graphic weight; mono labels give a technical, self-hosted feel

> This supersedes the earlier *editorial / warm-paper + coral* direction (it read too close to other AI products) and the original *indigo-on-white* look.

---

## Color

### Content & surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FAFAF8` | Page + editor background (paper) |
| `--bg-editor` | `#FAFAF8` | Editor surface |
| `--surface` | `#FFFFFF` | Modals, popovers, cards (pure white pops on paper) |
| `--surface-2` | `#F4F4F1` | Input backgrounds, table headers, hover fills |
| `--surface-3` | `#ECECE8` | Secondary hover, code chips |
| `--surface-4` | `#E2E2DD` | Active / pressed |

### Sidebar — calm light paper

A light warm-paper panel, only slightly off the content background and separated by a hairline — calm and low-contrast on purpose (a dark panel was tried and read as too harsh against the paper content). Identity comes from crisp structure and type, not a dark fill: mono uppercase section headers, a clean bordered search/filter, and the electric-blue active state. Page-node hover is a faint ink wash (`rgba(10,10,10,0.045)`); the selected node uses `--accent-dim` fill with `--accent-2` text and the blue left bar.

| Token | Value | Usage |
|-------|-------|-------|
| `--sb` | `#F3F2EC` | Sidebar background |
| `--sb-2` | `#EAE8DF` | Hover fill |
| `--sb-3` | `#DFDCD1` | Active fill |
| `--sb-4` | `#D0CCBF` | Deeper pressed state |
| `--text-sb` / `-2` / `-3` | `#1A1813` / `#57534A` / `#8A8576` | Ink text ramp on light paper |
| `--border-sb` | `rgba(10,10,10,0.09)` | Sidebar borders / separators |

### Sidebar information architecture

- **Top (workspace menu)** = everything settings/account: switch workspace, then a **Settings** group (Workspace settings · Backups · API keys) and an **Account** group (New/Join workspace · Admin · Sign out). The sidebar **collapse** toggle (`«`) lives in this header row, so the search field below spans full width and lines up with the page filter.
- **Footer** = content actions only: New page · Import · Trash.
- The old footer "Settings" (S3 backup/restore) was renamed **Backups** and moved into the top menu to remove the clash with "Workspace settings".

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text` | `#0A0A0A` | Primary — ink |
| `--text-2` | `#3A3A38` | Secondary — labels, descriptions |
| `--text-3` | `#8C8C88` | Tertiary — placeholders, hints |
| `--text-sb` / `-2` / `-3` | `#1A1813` / `#57534A` / `#8A8576` | Sidebar text ramp (ink on light paper) |

### Accent — Electric Blue

The single accent. Focus rings, active states, CTAs, key marks. Never decorative.

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#2B4DFF` | Buttons, active borders, left-bar indicator, the "why" block |
| `--accent-2` | `#1F3BD6` | Deeper blue (rarely needed — most hovers invert to ink) |
| `--accent-dim` | `rgba(43,77,255,0.08)` | Tinted backgrounds, focus rings, inline code |
| `--accent-mid` | `rgba(43,77,255,0.16)` | Stronger tint, text selection |
| `--accent-glow` | `rgba(43,77,255,0.22)` | Drop indicators |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#16A34A` | Positive feedback |
| `--danger` | `#DC2626` | Destructive actions, errors |
| `--danger-dim` | `rgba(220,38,38,0.08)` | Danger hover backgrounds |
| `--warning` | `#D97706` | Warnings |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `rgba(10,10,10,0.10)` | Hairline — dividers, row separators, grid lines |
| `--border-mid` | `rgba(10,10,10,0.16)` | Inputs, secondary buttons |
| `--border-sb` | `rgba(10,10,10,0.10)` | Sidebar borders |

**Structural rule:** major section dividers use a solid `2px solid var(--text)` — the defining Swiss move. Hairline `--border` is for rows and internal subdivisions.

---

## Typography

Three families, three jobs.

| Variable | Family | Role |
|----------|--------|------|
| `--font-ui` | **Archivo** | All UI chrome — sidebar, toolbars, buttons, body |
| `--font-title` | **Bricolage Grotesque** | Display headings, page titles, brand, big numbers — usually tight + UPPERCASE |
| `--font-mono` | **JetBrains Mono** | Labels, kickers, nav, code, kbd, "spec" annotations |

Loaded from Google Fonts with `display=swap`.

### Conventions

- **Display headings**: Bricolage 700–800, `letter-spacing: -0.03 to -0.04em`, `text-transform: uppercase`, `line-height: 0.9–1.0`.
- **Labels / kickers / nav / pricing annotations**: JetBrains Mono, 11–13px, `letter-spacing: 0.04–0.16em`, uppercase. Mono is the "technical voice" of the brand.
- **Body / editor**: Archivo, 14–15px.
- Numbers in stat/spec contexts use Bricolage for graphic impact (`€29`, `1×`, `0/mo`).

---

## Radius

Swiss = squared. Keep radii small; reserve `0` for statement surfaces (landing sections, auth card, primary CTAs).

| Token | Value | Used for |
|-------|-------|----------|
| `--radius-sm` | `3px` | Buttons, inputs, chips |
| `--radius` | `4px` | Default — cards, popovers, sidebar nodes |
| `--radius-lg` | `6px` | Larger cards, modals |

Hard edges (`border-radius: 0`) are intentional on: landing CTAs, the pricing sheet, the auth card, ticker.

---

## Shadows

Flatter than before — Swiss prefers borders over glow. Used for elevation only (modals, popovers), not for separating layout.

| Token | Value |
|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(10,10,10,0.05)` |
| `--shadow-sm` | `0 1px 3px rgba(10,10,10,0.07)` |
| `--shadow-md` | `0 4px 14px rgba(10,10,10,0.09)` |
| `--shadow-lg` | `0 10px 28px rgba(10,10,10,0.12)` |
| `--shadow-xl` | `0 20px 48px rgba(10,10,10,0.16)` |

**Hard offset shadow** (`Npx Npx 0 ...`) is a signature accent on statement cards (auth card uses `14px 14px 0`). Use sparingly.

---

## Motion

| Variable | Value | Character |
|----------|-------|-----------|
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Standard — confident, slight ease-out |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Overshoot — modal pop-ins |
| `--t` | `0.14s` | Hover/focus |
| `--t-slow` | `0.22s` | Entrances |

**Principle:** one orchestrated entrance per layer (staggered reveals on landing via `lp-rise`). Hover is fast. Respect `prefers-reduced-motion`.

---

## Component Patterns

### Buttons (`components/ui/Button.tsx` → `.btn`)

| Variant | Resting | Hover |
|---------|---------|-------|
| `primary` | electric blue fill, white text | **inverts to ink** (`--text`) |
| `secondary` | white, `--border-mid` | **inverts to ink** |
| `ghost` | transparent | subtle `--surface-3` fill |
| `danger` | `--danger-dim` tint | fills solid red |

Flat (no glow), `--radius-sm`, weight 600. The invert-to-ink hover is the house style.

### Modal (`components/ui/Modal.tsx`)

Shared shell for the manual modals (`TrashModal`, `ApiKeysModal`, `SharePageModal`, `WorkspaceSettingsModal`, `TemplatePicker`). Renders `overlay → content → header(title + close) → body`, stops content clicks bubbling, and closes on backdrop click + Escape. Props: `title`, `onClose`, `className` (content), `bodyClassName`, `closeOnOverlay`, `ariaLabel`, `onContentKeyDown`. (The two Ark UI Dialog modals — `ImportModal`, `SettingsModal` — keep their own focus-trap shell.)

### Field (`components/ui/Field.tsx`)

Label + control wrapper for `.auth-field` forms. Props: `label`, `htmlFor`, optional `accessory` (e.g. a "Forgot password?" link rendered in the `auth-field-header`), and the control as `children`.

### Inputs / focus ring

`border-color: --accent` + `box-shadow: 0 0 0 3px --accent-dim`. Never a bare colored border.

### Section dividers

`2px solid var(--text)` between major page sections. Internal rows use hairline `--border`.

### App sidebar (light panel)

Light warm-paper `--sb` panel, ink `--text-sb*` text, `--accent-dim` selected node + electric-blue left bar. Low-contrast and calm against the content area; identity comes from mono section headers, crisp bordered inputs, and the blue accent rather than a dark fill.

### Database table (spec sheet)

Column headers are JetBrains Mono, uppercase, 10.5px, with a `2px solid var(--text)` baseline rule. View switcher (Table/Board) uses an **ink-filled** active segment (`--text` bg, `--bg` text), matching the landing's "spec sheet" register.

### Modals / popovers

White card, `--border-mid`, `--radius-lg`, `--shadow-xl`, `modal-pop` entrance. Backdrop blur retained.

### Landing-specific (`.lp-*`)

Self-contained Swiss system on the marketing page: fixed `.lp-gridlines` overlay, `.lp-kicker` mono labels, spec strip, the `~/notara.sqlite` file object, the ink ticker marquee, numbered feature index (rows invert to ink on hover), blue "why" block, and the pricing **spec sheet** (white spec column + ink price panel). Reusable across the page but scoped to it.

---

## Dos and Don'ts

**Do:**
- Use `--accent` (blue) only for interactive/semantic meaning
- Reach for `2px solid var(--text)` to structure a page; hairlines for rows
- Use Bricolage uppercase for display, JetBrains Mono for labels/annotations
- Derive all colors from tokens — no hardcoded hex in components
- Favor borders and contrast for separation; shadows only for true elevation

**Don't:**
- Reintroduce the warm-paper/coral or indigo-on-white palettes (superseded)
- Add a second accent color without updating this doc
- Use large/pill radii or soft glowy shadows for layout — it breaks the Swiss read
- Use Bricolage for body text or long copy — it's a display face
