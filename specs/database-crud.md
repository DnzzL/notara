# Spec: Database CRUD Operations

## Overview

The database table provides inline cell editing for all field types, record
creation, and record deletion. Every cell edit goes through the same RPC path
(api.updateFieldValue → server → SQLite), and certain field types (select,
multi-select, relation) open sub-popovers for rich editing.

These tests cover the core data persistence loop and edge cases in the cell
editing UI — the areas most likely to have state-management bugs.

## Areas Under Test

| Area | Bug Surface | Test |
| ------ | ------------- | ------ |
| Text cell edit + Enter | Blur/Enter race, stale closure on save | DC-1 |
| Select cell -> pick option | SelectPopover state sync | DC-2 |
| Select inline option create | API call + local state race | DC-3 |
| Multi-select toggle | JSON serialization/deserialization | DC-4 |
| Number cell edit | Input validation, parse edge cases | DC-5 |
| Formula evaluation | Dependency tracking, re-eval after edit | DC-6 |
| Record delete | Row removal, state cleanup | DC-7 |

## Acceptance Criteria

- DC-1: Click a text cell, type a value, press Enter → value saved and displayed
- DC-2: Click a Select cell, pick an option → pill displayed
- DC-3: Click a Select cell, type a new value, click "Create" → option appears in
  both the cell AND the field's option list (re-open to verify)
- DC-4: Multi-select cell — click options → ✓ checkmarks, close → pills displayed
- DC-5: Click a Number cell, type a number, Enter → value displayed formatted
- DC-6: Create Number+Formula fields, edit the Number → Formula cell updates
- DC-7: Delete a record row → table no longer shows that record
