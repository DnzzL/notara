# Plan 001: Add Calendar and Gallery views to inline databases

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 425b8e2..HEAD -- packages/shared/src/schema.ts packages/shared/src/api.ts packages/app/src/components/DatabaseView.tsx packages/app/src/components/db/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts below against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `425b8e2`, 2026-06-18

## Why this matters

Inline databases currently support only **Table** and **Board** views
(`packages/shared/src/schema.ts:94`). For a Notion alternative, Calendar is the
most-requested view after those two, and the data model already has everything
it needs: a `date` field type exists (`schema.ts:58`) and file attachments now
render, so Gallery has content to show. A user migrating from Notion hits this
gap in the first few minutes — a project tracker with due dates has no calendar,
a media/moodboard database has no gallery. Adding these two views closes the most
visible feature-parity gap with a small, additive change: the view abstraction,
the saved-view machinery, and the per-database view toggle already exist and are
extended, not rebuilt.

This is scoped as a **focused MVP of each view**, not a full Notion clone of
them. Read-and-create is in scope; advanced interactions (drag-to-reschedule on
the calendar, gallery cover-image picker) are explicit follow-ups listed at the
end — do not build them.

## Current state

The view system is a clean three-part seam. The view *type* is a string literal
threaded through schema → RPC → UI, plus a free-text SQLite column.

### 1. Shared schema — the type literal (the type-safety gate)

`packages/shared/src/schema.ts:90-99`:
```ts
export class DatabaseView extends Schema.Class<DatabaseView>("DatabaseView")({
  id: Schema.String,
  databaseId: Schema.String,
  name: Schema.String,
  type: Schema.Literal("table", "board"),
  groupByFieldId: Schema.NullOr(Schema.String),
  sortFieldId: Schema.NullOr(Schema.String),
  sortOrder: Schema.Literal("asc", "desc"),
  config: Schema.String,
}) {}
```

`packages/shared/src/api.ts` — the `createView` (line 178-187) and `updateView`
(line 188-197) RPCs each repeat the literal:
```ts
// createView payload
type: Schema.Literal("table", "board"),
// updateView payload
type: Schema.optional(Schema.Literal("table", "board")),
```

The field type literal at `schema.ts:57-59` already includes `"date"`:
```ts
export const DatabaseFieldType = Schema.Literal(
  "text", "number", "select", "multiSelect", "date", "checkbox", "relation", "page", "formula", "people",
);
```

### 2. Server — no validation to change

`packages/server/src/handlers/databases.ts:425-438` — `createView` takes
`type: string` and writes it verbatim; `updateView` (line 440-464) likewise. The
`database_views.type` column is plain `TEXT` (migration
`packages/server/migrations/001_initial.sql:63`). **The server needs no change** —
widening the literal in `shared` is the entire type-level change. Do not add a
server-side allowlist; the schema literal is the gate, consistent with how
`"table"`/`"board"` are handled today.

### 3. App — the toggle, the dispatch, and the sibling components

- `packages/app/src/components/DatabaseView.tsx` is the host. It holds view state:
  - `viewType` state initialized from `localStorage` (`DatabaseView.tsx:265-276`),
    defaulting `"board"` only when stored, else `"table"`.
  - Sync from the active saved view (`DatabaseView.tsx:349-362`):
    `if (view?.type && view.type !== viewType) setViewType(view.type);`
  - **Dispatch**: `if (viewType === "board") { return <BoardView .../> }`
    (`DatabaseView.tsx:729-740`), otherwise it falls through to the inline Table
    render (`DatabaseView.tsx:742+`).
  - **The Table/Board toggle** is a two-button group, duplicated in BOTH the
    table branch (`DatabaseView.tsx:748-759`) and inside `BoardView` itself
    (`BoardView.tsx:277-280`). Each button does three things on click:
    `setViewType(x)`, write `localStorage.setItem(\`db-view:${database.id}\`, JSON.stringify({ viewType: x }))`,
    and `if (activeViewId) updateView(activeViewId, { type: x })`.
- `packages/app/src/components/db/BoardView.tsx` — the model to follow for a new
  view component. Note its props signature (`BoardView.tsx:15-22`):
  ```ts
  export function BoardView({
    database, fields, records, databases, currentView, onChangeView, allRecords = {}, onOpenRecord,
  }: {
    database: any; fields: any[]; records: any[]; databases: any[];
    currentView: "table" | "board"; onChangeView: (v: "table" | "board") => void;
    allRecords?: Record<string, any[]>;
    onOpenRecord?: (record: any) => void;
  }) { ... }
  ```
  Each `record` in `records` has shape `{ record: DatabaseRecord, values: Record<fieldName, string> }`
  — see how BoardView reads `r.values[groupField.name]` (`BoardView.tsx:84`) and
  `record.record.title` / `record.record.pageId` (`BoardView.tsx:252,235`).
- `packages/app/src/components/db/ViewSwitcher.tsx` — the saved-views dropdown.
  Its prop is typed `currentViewType: "table" | "board"` (line 12) and it renders
  a per-view icon switch on `view.type === "board"` (line 169). It must accept the
  new types but needs no behavioral change beyond the type widening and an icon
  fallback.
- `packages/app/src/components/db/CellComponents.tsx` exports `CellDisplay`
  (used in BoardView at line 262 as `<CellDisplay field={f} value={val} databases={databases} allRecords={allRecords} />`)
  — **reuse this** to render field values inside calendar/gallery cells. Do not
  write new cell renderers.

### Conventions to match

- **Styling**: Tailwind utility classes inline on elements, using the repo's
  semantic tokens (`bg-surface`, `bg-surface-2/3/4`, `text-text`, `text-text-2/3`,
  `border-border`, `border-border-mid`, `shadow-[var(--shadow-lg)]`,
  `rounded-[5px]`, transition pattern `transition-[background,color] duration-[var(--t)] ease-[var(--ease)]`).
  CSS was migrated off `styles.css` to Tailwind v4 utilities (backlog NOT-25,
  done) — **do not add rules to `styles.css`**; use utility classes like BoardView.
  Copy BoardView's exact class strings for cards/columns as your starting point.
- **Components**: prefer existing primitives. `cn` helper is `../ui/cn.js`.
  Reuse `CellDisplay` and `SelectPill` from `./CellComponents.js`.
- **No new deps.** date-grid math is small; write it by hand (see Step 3).
- The pitch's "use @tiptap / @ark-ui — don't reinvent the wheel" rule
  (`docs/pitch.md:44-47`) applies to editor/UI widgets, not to a domain layout
  like a month grid. A hand-rolled CSS grid is correct here.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Server typecheck | `bun --bun tsc --noEmit -p packages/server` | exit 0, no errors |
| App typecheck | `bun --bun tsc --noEmit -p packages/app` | **see note below** |
| Shared build | `bun run --filter @notara/shared build` | exit 0 |
| Server tests | `bun test packages/server/test` | all pass (~91 tests) |
| Dev (manual check) | `bun run dev:server` + `bun run dev:app` | server :3000, app :5173 |

> **App typecheck note**: `packages/app` has **pre-existing** TS errors that are
> NOT yours (per `CLAUDE.md` §3: `PageReferenceMenu` extensions, `import.meta.env`
> in `__root.tsx`). Capture the baseline error list FIRST:
> `bun --bun tsc --noEmit -p packages/app 2>&1 | sort > /tmp/tsc-app-before.txt`
> After your changes, diff against it. Your done-criterion is **zero NEW errors**,
> not zero errors. If you cannot run tsc, say so explicitly — do not claim success.

## Scope

**In scope** (the only files you should modify or create):
- `packages/shared/src/schema.ts` — widen the `DatabaseView.type` literal
- `packages/shared/src/api.ts` — widen `createView`/`updateView` `type` literals
- `packages/app/src/components/DatabaseView.tsx` — toggle buttons + dispatch
- `packages/app/src/components/db/ViewSwitcher.tsx` — widen prop type + icon
- `packages/app/src/components/db/CalendarView.tsx` — **create**
- `packages/app/src/components/db/GalleryView.tsx` — **create**
- `e2e/database-views.spec.ts` — **create** (optional E2E, see Test plan)

**Out of scope** (do NOT touch, even though they look related):
- `packages/server/src/handlers/databases.ts` — server is type-agnostic on view
  type by design; adding validation here would duplicate the schema gate.
- The Board drag-and-drop logic in `BoardView.tsx` — leave it entirely alone.
- `packages/server/src/handlers/templates.ts` — template seeding is a separate
  effort (plan D2, not in this round).
- Drag-to-reschedule, gallery cover-image config, week/day calendar modes — these
  are deferred follow-ups (see Maintenance notes).

## Git workflow

- Branch: `advisor/001-calendar-gallery-views`
- Commit per step (or per logical unit). The repo uses Conventional Commits — recent
  example from `git log`: `fix(pwa): stop nginx types block from clobbering global MIME map`.
  Use e.g. `feat(db): widen view type literal for calendar/gallery`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Widen the view-type literal in shared

In `packages/shared/src/schema.ts:94`, change:
```ts
type: Schema.Literal("table", "board"),
```
to:
```ts
type: Schema.Literal("table", "board", "calendar", "gallery"),
```

In `packages/shared/src/api.ts`, make the same widening in **both** the
`createView` payload (line ~182) and the `updateView` payload (line ~192):
```ts
type: Schema.Literal("table", "board", "calendar", "gallery"),            // createView
type: Schema.optional(Schema.Literal("table", "board", "calendar", "gallery")), // updateView
```

**Verify**:
- `bun run --filter @notara/shared build` → exit 0
- `bun --bun tsc --noEmit -p packages/server` → exit 0 (server passes `type: string`,
  so widening is safe). If the server fails to typecheck, STOP — the seam is not
  what this plan assumed.

### Step 2: Widen the view-type union in the app's view components

The app uses the literal union `"table" | "board"` in several typed props. Widen
them to `"table" | "board" | "calendar" | "gallery"`:

- `DatabaseView.tsx:265` — `useState<string>` is already `string`; no change to
  the state type, but the `onChangeView`/`currentView` casts (lines 734, 747) and
  the toggle handlers must accept the new values.
- `ViewSwitcher.tsx:12` — change `currentViewType: "table" | "board";` to the
  4-member union. Add an icon branch so non-board/table views still render: in the
  per-view icon (`ViewSwitcher.tsx:168-176`), leave the existing board/table branch
  and let calendar/gallery fall through to the default (table-like) glyph — a
  distinct icon is nice-to-have, not required.
- `BoardView.tsx:19` — its `currentView` / `onChangeView` are typed
  `"table" | "board"`. **Do not widen BoardView's own props** (it only ever shows
  Table/Board toggles). Instead, in `DatabaseView.tsx`, the toggle that switches to
  calendar/gallery lives in the *table-branch* toolbar (Step 4), not inside BoardView.

**Verify**: `bun --bun tsc --noEmit -p packages/app 2>&1 | sort > /tmp/tsc-app-after-step2.txt`
then `diff /tmp/tsc-app-before.txt /tmp/tsc-app-after-step2.txt` → no NEW errors.

### Step 3: Create `CalendarView.tsx` (read + create-on-day MVP)

Create `packages/app/src/components/db/CalendarView.tsx`. Mirror `BoardView`'s
props signature and store usage. Behavior:

1. Pick the **date field**: the first field with `type === "date"`. Expose a
   "Date field:" `<select>` in the toolbar (mirror BoardView's "Group by:" select,
   `BoardView.tsx:282-292`) so the user can choose which date field drives the
   calendar. If there is **no** date field, render an empty-state message
   (`bg-surface-2` panel, `text-text-3`): "Add a Date field to use the calendar
   view." — do not crash.
2. Render a **month grid**: a header with `‹ Month YYYY ›` navigation (prev/next
   month buttons updating a `useState` for the displayed month) and a 7-column CSS
   grid (`grid grid-cols-7`) of day cells for the visible month, padded with the
   leading/trailing days to fill complete weeks. Compute the grid by hand:
   ```ts
   // first day shown = the Sunday on/before the 1st of the month
   const first = new Date(year, month, 1);
   const start = new Date(first); start.setDate(first.getDate() - first.getDay());
   // render 42 cells (6 weeks) from `start`
   ```
3. Place each record on its day: parse `r.values[dateField.name]`. Date values are
   stored as strings — inspect a real value first (create a record with a date in
   the running app, then read the cell value) and match the stored format. Compare
   by local calendar day (`YYYY-MM-DD` prefix), not by timestamp equality.
4. Each day cell shows the day number and a vertical list of records whose date is
   that day, each as a small chip showing `record.record.title`. Clicking a chip
   calls `onOpenRecord?.(record.record)` (same as BoardView, `BoardView.tsx:249`).
5. A `+` affordance on hover of a day cell creates a record: mirror BoardView's
   "+ New" (`BoardView.tsx:363-369`) — `prompt("New record title:")`, then
   `createDbRecord(database.id, title)`, then set that record's date-field value to
   the clicked day via `updateFieldValue(recordId, dateField.id, "YYYY-MM-DD")`
   (see BoardView's `updateFieldValue` usage at line 210), then `loadDbRecords`.
   If wiring the date back is non-trivial for the stored format, create the record
   without a date and reload — note this in your final summary; do not block on it.
6. Include the `<ViewSwitcher databaseId={database.id} currentViewType="calendar" />`
   and the same view-toggle button group as the table branch (Step 4) in the
   CalendarView toolbar, so users can switch back out.

Render field values with `CellDisplay` where you show more than the title.

**Verify**: app typecheck shows no NEW errors; the file compiles.

### Step 4: Create `GalleryView.tsx` and wire both into the toggle + dispatch

Create `packages/app/src/components/db/GalleryView.tsx`: a responsive card grid
(`grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]`). Each
record → one card (reuse BoardView's card class string,
`BoardView.tsx:239`-ish, minus the drag handle). The card shows
`record.record.title` and the non-hidden field values via `CellDisplay`. Clicking
a card calls `onOpenRecord?.(record.record)`. Include the ViewSwitcher + view
toggle in its toolbar.

Then wire both views into `DatabaseView.tsx`:

1. **Dispatch** — extend the branch at `DatabaseView.tsx:729`. Before the
   `if (viewType === "board")` block, add:
   ```tsx
   if (viewType === "calendar") {
     return (<><CalendarView database={database} fields={dbFields} records={sortedRecords}
       databases={databases} onChangeView={setViewType} allRecords={dbRecordCache}
       onOpenRecord={handleOpenRecord} />{recordPanel}</>);
   }
   if (viewType === "gallery") {
     return (<><GalleryView database={database} fields={dbFields} records={sortedRecords}
       databases={databases} onChangeView={setViewType} allRecords={dbRecordCache}
       onOpenRecord={handleOpenRecord} />{recordPanel}</>);
   }
   ```
   (Match the exact prop names already passed to `<BoardView>` at lines 732-736.)
2. **Toggle buttons** — the button group at `DatabaseView.tsx:748-759` has two
   buttons (Table, Board). Add **Calendar** and **Gallery** buttons following the
   exact same pattern (the 3-line onClick: `setViewType`, `localStorage.setItem`,
   `if (activeViewId) updateView(activeViewId, { type })`). The new buttons must
   appear in this toggle group so they're reachable. Add the matching buttons to the
   toggle groups inside CalendarView and GalleryView too (so users can leave them).
   Import both new components at the top of `DatabaseView.tsx` next to the BoardView
   import (`DatabaseView.tsx:17`).

**Verify**:
- `bun --bun tsc --noEmit -p packages/app` → no NEW errors vs `/tmp/tsc-app-before.txt`
- `bun --bun tsc --noEmit -p packages/server` → exit 0
- `bun test packages/server/test` → all pass (sanity; this change is frontend-only)

### Step 5: Manual end-to-end check

Run `bun run dev:server` and `bun run dev:app`. In a workspace:
1. Create a page, add an inline database, add a `date` field and 2-3 records with dates.
2. Use the view toggle → switch to **Calendar**: records appear on their days;
   month nav works; clicking a record opens its panel; `+` on a day creates a record.
3. Switch to **Gallery**: records render as cards; clicking opens the panel.
4. Save the calendar view via "Save as view" in the ViewSwitcher, reload the page,
   reopen the saved view → it comes back as a calendar (the `type` round-trips
   through `createView`/`updateView`).

## Test plan

- **Server tests**: no new server test needed — the server treats `type` as an
  opaque string and existing `handlers.test.ts` already exercises `createView`.
  Run the suite to confirm no regression: `bun test packages/server/test`.
- **E2E (optional but preferred)**: create `e2e/database-views.spec.ts`, modeled
  structurally on `e2e/board-drag-drop.spec.ts` (same fixtures, same setup). Cover:
  (a) switching a database to Calendar shows the month grid;
  (b) a record with a date appears in the calendar;
  (c) switching to Gallery shows record cards.
  Run with the repo's Playwright setup (`npx playwright test database-views`).
  If the Playwright harness needs a running server/build you cannot start in your
  environment, write the spec but note in your final summary that it was not
  executed — do not claim it passed.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run --filter @notara/shared build` exits 0
- [ ] `bun --bun tsc --noEmit -p packages/server` exits 0, no errors
- [ ] `bun --bun tsc --noEmit -p packages/app` introduces **zero new** errors vs the
      captured baseline (`diff /tmp/tsc-app-before.txt /tmp/tsc-app-after.txt` empty)
- [ ] `bun test packages/server/test` — all pass
- [ ] `grep -rn '"table", "board"' packages/shared/src` returns **no** matches
      (every view-type literal was widened)
- [ ] `packages/app/src/components/db/CalendarView.tsx` and `GalleryView.tsx` exist
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `425b8e2`).
- Widening the shared literal breaks the **server** typecheck — it means the server
  is not type-agnostic on view type as this plan assumes; the seam is different.
- The `record.values` shape or date-field stored format is not what Step 3 assumes,
  and you cannot determine the real format from a running instance.
- Switching to a new view type throws at runtime in `DatabaseView.tsx` because of a
  code path (e.g. the saved-view sync at lines 349-362) that hard-assumes
  table/board — report what it is rather than special-casing around it.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Saved-view persistence**: view type round-trips through `database_views.type`
  (free-text column) and `localStorage` key `db-view:<databaseId>`. There is no
  migration and no enum constraint, so adding a 5th view later is the same 3-edit
  seam (schema literal, two api literals, a dispatch branch + toggle button).
- **Reviewer should scrutinize**: that the toggle group and dispatch stay in sync
  (a view reachable by toggle but with no dispatch branch silently falls through to
  the table render), and that no Board DnD code was touched.
- **Deliberately deferred follow-ups** (do NOT build now): drag-to-reschedule on the
  calendar (would reuse `@dnd-kit`, already a dep), week/day calendar modes, a
  gallery cover-image / card-preview-field picker, and respecting active
  filters/sorts inside the new views (Calendar/Gallery here render `sortedRecords`,
  which already has the active sort applied; verify filters apply too and note if not).
