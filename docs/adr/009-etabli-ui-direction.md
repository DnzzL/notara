# 009 — Établi: the app's working surface, and the database on a phone

Date: 2026-08-28
Status: accepted
Ticket: NOT-130

## Context

Notara's landing page had a settled visual identity — warm paper `#FAFAF8`,
near-black ink, a single electric blue, Bricolage Grotesque over Archivo over
JetBrains Mono. The app interior did not carry it. The database view in
particular had never joined the design system at all: it was Tailwind utilities
over Notion's palette (`#2eaadc`, `#37352f`, `#e9e9e7`, `#d3d1cb`), so no amount
of token work in `styles.css` reached it.

Separately, a database on a phone was a table pushed sideways
(`.table-view { overflow-x: auto }`) — and that rule matched no element, so even
that was not happening.

Four directions were prototyped side by side on a throwaway branch
(`proto/ui-directions`, route `/_proto/ui`), switchable by search param, with
the mobile treatment as an independent second axis.

## Decision

**Établi** for the working surface, **the field ruler** for the database on a
narrow screen.

Établi is the Swiss register of the landing page brought inside, minus the ink
that made it tiring to work in all day:

| Kept | Dropped |
|---|---|
| Warm paper, mono micro-labels, tabular numerals | The visible drafting grid |
| Two 2px ink rules framing the data table | 2px rules as a general divider |
| Bricolage on the page title | Bricolage uppercase inside the app |
| Electric blue, strictly for state and primary action | Ink-filled active states |

The rule the variant exists to enforce: **every mark on the working surface must
carry information.** A select value is legible from its dot, so it does not also
get a pill around it.

On a narrow screen each view is *replaced*, not reflowed, and all three share one
navigation language — a scrollable tab strip, a mono caption, then touch-sized
rows:

| View | What you navigate |
|---|---|
| Table | the **field**, not the row — the list stays put while the column changes |
| Board | the **group**, not the column — one group's cards, full width |
| Calendar | nothing; it becomes an **agenda** |

## Alternatives considered

- **Atelier** — the same Swiss grid taken literally: visible drafting grid, zero
  radius, filets everywhere, ink-filled active states. Rejected as too heavy for
  a product about focus. Établi keeps its typographic discipline and drops its ink.
- **Console** — Linear-grade density with no display face. Rejected alone as
  indistinguishable from its inspiration; Établi is Console plus Atelier's
  typography.
- **Marge** — content column pristine, all metadata in a persistent marginalia
  rail. Genuinely distinctive, and the biggest structural bet. Not chosen: it
  reorganises the page for every feature, not just the database.
- **Mobile: record cards** (Airtable's answer) — good for browsing, weak for
  editing. **Mobile: frozen title column** — preserves the spreadsheet reflex but
  costs a gesture per field. The ruler was chosen because setting one property
  across thirty records is thirty taps in one place rather than thirty round trips.

## Consequences

- `docs/design-system.md` is the living reference; this ADR records *why*.
- `packages/app/test/design-tokens.test.ts` enforces the colour and radius rules,
  because a prose document cannot fail — this one claimed for months that the
  sidebar's selected node used the accent when the code used a taupe fill.
- `packages/app/src/lib/useIsCompact.ts` is the only JS breakpoint in the app and
  should stay reserved for markup that differs, not layout that adapts.
- Dragging a card between board columns has no thumb equivalent and is not
  offered on narrow screens; the record is one tap away instead.
- A future Team tier changes none of this.
