# Spec: Popover Positioning (NOT-77)

## Overview

The `Popover` component measures its height once on mount (useEffect keyed only
on `[triggerRect]`) and never recomputes when content grows. This causes action
buttons to be pushed outside the viewport in any popover with post-mount growth.

## Root Cause

File: `packages/app/src/components/db/CellComponents.tsx:75`

```typescript
useEffect(() => {
  if (!triggerRect || !ref.current) return;
  const el = ref.current;
  el.style.visibility = "hidden";
  el.style.display = "block";
  const w = el.offsetWidth;
  const h = el.offsetHeight;            // ← measures height ONCE
  // ...positions based on that one measurement...
  setPos({ top, left });
}, [triggerRect]);                       // ← only re-runs when triggerRect changes
```

Because the popover uses `position: fixed`, scrolling the page cannot bring the
off-screen portion back into view.

## Affected Popovers

| Popover | File | Growth Trigger | Impact |
| --------- | ------ | --------------- | -------- |
| `AddFieldPopover` | `FieldComponents.tsx:932` | Select/Multi-select options, Relation async load, Advanced fold, Formula textarea | Create button pushed off-screen |
| `OptionsEditor` | `DatabaseView.tsx:1731` (wraps `FieldComponents.tsx:658`) | Adding new select options | Popover grows, may clip |
| `FormulaEditor` | `DatabaseView.tsx:1751` | Textarea resize | Action buttons may shift |
| `ColumnHeader` popover | `FieldComponents.tsx:192` | Rename mode toggle | Minor (fixed content) |
| `SelectPopover` | `CellComponents.tsx:741` | Inline option create | List may overflow (scrollable) |
| `RelationPopover` | `CellComponents.tsx:898` | Async record load | Content may shift after mount |
| `CellAnchoredPopover` | `CellComponents.tsx:168` | Any content change | Same measurement-once pattern (useLayoutEffect(() => {}, [])) |

## Fix Strategy

Replace the static `useEffect` measurement with a `ResizeObserver`:

1. Measure on mount (current behavior)
2. Attach a ResizeObserver to `ref.current` to recompute position whenever
   the content's bounding box changes
3. Recompute the flip-above / clamp-to-viewport logic on each resize
4. Debounce the observer to avoid layout thrash during rapid content changes
5. Apply the same fix to `CellAnchoredPopover` (same one-measure pattern)

## Acceptance Criteria

- AC #1 — Popover recomputes position via ResizeObserver
- AC #2 — Select field with 3+ options at 1280x720: Create button visible and clickable
- AC #3 — Content growing beyond viewport bottom triggers flip-above or internal scroll,
  with the primary action always reachable

## E2E Tests

File: `e2e/popover-positioning.spec.ts`

| ID | Test | Covers |
| ---- | ------ | -------- |
| PF-1 | Add-field Select + 3 options → Create clickable | AC #2 (core NOT-77 repro) |
| PF-2 | Add-field Multi-select + 5 options → Create clickable | AC #2 (many options) |
| PF-3 | Add-field Relation type → async DB list load | AC #1 (async growth) |
| PF-4 | Add-field Advanced fold → Create clickable | AC #1 (structural growth) |
| PF-5 | OptionsEditor → add 4 options stays in viewport | AC #1 (nested popover) |
| PF-6 | Add-field Formula type → Create clickable | AC #1 (formula textarea) |

### Gherkin Scenarios

```gherkin
Feature: Popover Positioning
  As a user adding fields to a database table
  I want the popover to stay within the viewport
  So that I can always reach the Create button

  Scenario: Add select field with multiple options
    Given I have a page with a database table
    When I open the Add property popover
    And I select "Select" type
    And I add 3 options: "High", "Medium", "Low"
    Then the "Create" button should be inside the viewport
    And clicking "Create" should close the popover and add the field

  Scenario: Add relation field after async load
    Given I have a page with a database table
    When I open the Add property popover
    And I select "Relation" type
    Then the database list should load asynchronously
    And the "Create" button should remain inside the viewport

  Scenario: Edit options of existing select field
    Given I have a database table with a Select field "Status"
    When I click the Status column header
    And I click "Edit options" in the popover
    And I add 4 options: "Blocked", "Review", "Done", "Deferred"
    Then the option input should stay within the viewport

  Scenario: Switch to advanced types
    Given I have a page with a database table
    When I open the Add property popover
    And I click "Show advanced"
    Then the advanced type list should be visible
    And the "Create" button should remain inside the viewport
```
