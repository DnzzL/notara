# Notara Design System

A living reference for the visual language of Notara. All tokens live in `:root` inside `packages/app/src/styles.css` and are the single source of truth for any new UI work.

---

## Personality

Notara is a **content-first** writing tool with a **Swiss / International typographic** chrome. The aesthetic:

- **Paper, not screen** — warm off-white (`#FAFAF8`), never clinical pure white
- **Ink + one signal** — near-black ink and a single electric blue. No gradients, no second accent
- **Structural, but rationed** — hairlines do the everyday work; the 2px ink rule is a statement and appears at most twice per screen
- **Dense and calm** — the working surface is compact (32px rows, 13.5px chrome). Density comes from tight rhythm, not from cramming
- **Squared** — small radii (3–6px), flat fills. Borders carry the design, not shadows
- **Display used once** — Bricolage Grotesque earns its weight by being rare: one title per screen inside the app, uppercase reserved for marketing surfaces. Mono labels give the technical, self-hosted voice

> This supersedes the earlier *editorial / warm-paper + coral* direction (it read too close to other AI products) and the original *indigo-on-white* look.

### Établi — the working surface (2026-08)

The app interior follows a named variant of the system, **Établi**, arrived at by prototyping four directions side by side (see `NOT-130`). It is the Swiss identity of the landing page brought inside, minus the ink that made it tiring to work in all day:

| Kept from the Swiss register | Deliberately dropped |
|---|---|
| Warm paper, mono micro-labels, tabular numerals | The visible drafting grid — it was most of the visual noise |
| Two 2px ink rules framing the data table | 2px rules as a general-purpose divider |
| Bricolage on the page title | Bricolage uppercase inside the app |
| Electric blue, strictly for state and primary action | Ink-filled active states in the sidebar and view switcher |

**The rule this variant exists to enforce:** every mark on the working surface must carry information. A select value is legible from its dot — so it does not also get a pill around it.

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

The single accent. Never decorative. Inside the app it is allowed in exactly five places:

1. Focus rings
2. The hovered/focused table row (tint + 2px left bar)
3. The active sidebar node (2px left bar + accent text)
4. The primary action of a surface (one per surface)
5. The selected option inside a picker

Anything else that "would look nice in blue" is a bug in the design, not a decision.

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
| `--danger-mid` | `rgba(220,38,38,0.18)` | Danger borders — the step between dim and solid |
| `--star` | `#D9A441` | Favourite. A mark, not a warning — the two were conflated |
| `--scrim` | `rgba(15,18,30,0.40)` | Behind every modal, sheet and panel. Was 5 hardcoded backdrops at 3 alphas |
| `--hover-ink` | `rgba(10,10,10,0.05)` | The neutral hover wash on paper |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `rgba(10,10,10,0.10)` | Hairline — dividers, row separators, grid lines |
| `--border-mid` | `rgba(10,10,10,0.16)` | Inputs, secondary buttons |
| `--border-sb` | `rgba(10,10,10,0.10)` | Sidebar borders |

**Structural rule:** the `2px solid var(--text)` ink rule is the defining Swiss move and is therefore rationed, and only ever frames a data surface. On desktop that is two per database — the table's header baseline and the status line. On a narrow screen the tab strip's baseline is a third, which is the ceiling: it brackets the strip, the rows and the status line into one object. Everything else (rows, panels, section splits, sidebar edges) uses hairline `--border`.

On marketing surfaces (`.lp-*`, auth) the 2px rule stays a free structural device; those pages are read once, not worked in.

---

## Typography

Three families, three jobs.

| Variable | Family | Role |
|----------|--------|------|
| `--font-ui` | **Archivo** | All UI chrome — sidebar, toolbars, buttons, body |
| `--font-title` | **Bricolage Grotesque** | Display headings, page titles, brand, big numbers. Uppercase on marketing surfaces only |
| `--font-mono` | **JetBrains Mono** | Labels, kickers, nav, code, kbd, "spec" annotations |

Loaded from Google Fonts with `display=swap`.

### Conventions

Bricolage is a display face and behaves differently on the two kinds of surface.

| | Marketing (landing, auth, legal) | App (workspace, database, editor) |
|---|---|---|
| Bricolage | Free to use across headings | **One title per screen**, nowhere else |
| Case | `text-transform: uppercase` | Title case — uppercase reads as shouting on a surface you sit in all day |
| Size / weight | 700–800, `-0.03 to -0.04em` | 700, 25px, `-0.028em` |

- **Labels / kickers / column headers**: JetBrains Mono, 9–13px, `letter-spacing: 0.04–0.16em`, uppercase. Mono is the "technical voice" of the brand — this one is the same on both surfaces.
- **Body / editor**: Archivo 14–15px. **App chrome**: Archivo 13.5px.
- **Numbers that get compared** (a TJM column, a record count, a date) use `--font-mono` with `font-variant-numeric: tabular-nums`, so digits line up down the column. Numbers that get *admired* (a landing stat, a price) use Bricolage.

---

## Density

The working surface is compact on purpose. A database is a place you scan, and scanning costs a scroll per row.

| Token | Value | Used for |
|-------|-------|----------|
| `--row` | `32px` | Database table rows, sidebar nodes, list rows |
| `--row-touch` | `48px` | Any row that is a tap target on mobile |

- App chrome text is **13.5px**; editor body stays 15px. The editor is for reading, the chrome is for operating.
- Tap targets stay ≥44px on touch regardless of `--row` — density is a pointer-device affordance, not a universal one.

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

## Primitives (`components/ui/`)

Reach for these before writing a class string. They exist because the same string was already written five to eight times and the copies had drifted.

| Primitive | Covers | Why it exists |
|---|---|---|
| `Button` / `IconButton` | Every action | 4 variants × 3 sizes; forwards `ref` so popovers can anchor to it |
| `Input` / `Select` | Every text/number/date/select field | **The one focus treatment.** The app had five |
| `Tabs` | Mode toggles and pane navigation | Encodes the two active languages below. The view-type control lives in `db/viewTypes.ts` and is used by all three views |
| `MenuItem` | Any dropdown or popover row | Was copy-pasted 8× in `WorkspaceSwitcher` alone |
| `Badge` | A value that carries state or metadata | Defaults to a dot, not a pill. Multi-select cells collapse past two values into a `+N` badge rather than wrapping the row |
| `Field`, `Modal` | Form rows, modal shells | |

`packages/app/test/design-tokens.test.ts` enforces the colour and radius rules. It does **not** enforce primitive usage — that is a review question, not a machine one.

### Active, and what kind of active

The app once expressed "active" six ways for what was mostly one idea. Three roles now, and the distinction carries meaning:

| Role | Question it answers | Treatment |
|---|---|---|
| **Toggle** | Which *mode* of the same content? (Table / Board / Calendar) | Solid `--accent` fill, white text. A switch should read as thrown |
| **Navigation** | Which *place* am I in? (page tree, saved view, workspace, admin pane) | `--accent-dim` tint + a 2px `--accent` marker — left bar in a vertical list, underline on a horizontal row |
| **Selection** | Which *data* is picked? (a row, an option) | `--accent-dim` tint, no marker |

Never an ink fill. `bg-text text-bg` was the loudest thing on the working surface and is reserved for marketing surfaces.

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

`border-color: --accent` + `box-shadow: 0 0 0 3px --accent-dim`. Never a bare coloured border — `focus:border-accent` on its own was the single most common divergence. Use `ui/Input.tsx`, which is where this lives now; the global `:focus-visible` outline stays as the keyboard fallback for everything that is not a field.

### Section dividers

`2px solid var(--text)` between major page sections. Internal rows use hairline `--border`.

### App sidebar (light panel)

Light warm-paper `--sb` panel, ink `--text-sb*` text, `--accent-dim` selected node + electric-blue left bar. Low-contrast and calm against the content area; identity comes from mono section headers, crisp bordered inputs, and the blue accent rather than a dark fill.

### Database table (`.db-table`, styles.css)

The database view is otherwise built from Tailwind utilities and inline styles; only the decisions that belong to the *system* rather than to a component live in CSS:

- Column headers: JetBrains Mono, uppercase, 10px, `0.1em` tracking, with the `2px solid var(--text)` baseline rule. The field-type marker carries `.db-type-glyph`, which opts out of the uppercase — otherwise `Aa` renders as `AA`.
- Rows are `var(--row)` tall and their vertical padding is zeroed, so `--row` is the single number that decides record height. (Before this, the row gutter's controls stacked and every record was ~78px.)
- `number` and `date` cells use mono + `tabular-nums`; `number` is right-aligned. Digits in a column line up.
- Hover: `--accent-dim` tint plus a 2px accent left bar.
- The view switcher's active segment is **accent-filled**, not ink-filled. Ink fills were the single loudest thing on the working surface.

### Database status line (`.db-statusline`)

The second ink rule, directly under the table. It carries two jobs at once — *where you are* (filters, sort, view type) and *what this is* (record count, field count) — so the surface needs one footer instead of two. Mono, 11px, tabular numerals, `--sb` panel.

### Database on a narrow screen

Below 880px each view is **replaced**, not reflowed. All three share one navigation language — a horizontally scrollable strip of tabs (`db/Strip.tsx`), a mono caption stating where you are, then a list of `--row-touch` rows. `Strip` is a real tablist: roving tabindex, arrow keys, `aria-controls`. The bar above them is one shared shell, `db/DatabaseToolbar.tsx` — it used to exist three times, which is how a responsive fix landed on one view and left the other two with the database name floating below the view selector.

| View | What you navigate | Component |
|---|---|---|
| Table | the **field**, not the row — the record list stays put while the column changes | `db/MobileRuler.tsx` |
| Board | the **group**, not the column — one group's cards, full width | `db/MobileBoard.tsx` |
| Calendar | the **date field**, when there is more than one — otherwise nothing; it becomes an **agenda**, days in order, undated last | `db/MobileAgenda.tsx` |

Tapping a value raises a bottom sheet around the same `InlineCellEditor` the desktop table uses, and every picker (`Popover`, `CellAnchoredPopover`, the relation autocomplete) becomes a `.db-popover-sheet`, so per-type behaviour has one implementation.

Two rules that cost a bug each:

- **Branch below the toolbar, never above it.** An early return that skips the view's own toolbar strands the user in a view with no way back.
- **Don't keep a control whose scope the new layout doesn't have.** The calendar's month stepper is hidden in agenda mode: the agenda lists every record, so a month claim would be a lie.

Agenda grouping is a pure function in `lib/agenda.ts` with its own test — ordering and the undated bucket are where an agenda quietly goes wrong.

Rows are `--row-touch` (48px). Sheet inputs are 16px — anything smaller makes iOS Safari zoom the viewport on focus.

This is the one place where narrow means a different component rather than a reflowed one, which is why `lib/useIsCompact.ts` exists. **Reach for a media query first.** The hook is for markup that differs, not layout that adapts.

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
- Hardcode a hex in a component. The database view spent a long time full of Notion's palette (`#2eaadc`, `#37352f`, `#e9e9e7`) and simply did not participate in this system — a redesign was mostly a find-and-replace
- Write a CSS rule for a class no element carries. `.table-view` and the `.sidebar` mobile drawer were both dead for months, which is what actually made the app unusable on a phone. If a rule matters, assert it in the browser
- Put `display: none` for mobile-only chrome *after* the media query that turns it on — equal specificity means source order wins and the rule dies silently
- Reintroduce the warm-paper/coral or indigo-on-white palettes (superseded)
- Add a second accent color without updating this doc
- Use large/pill radii or soft glowy shadows for layout — it breaks the Swiss read
- Use Bricolage for body text or long copy — it's a display face
