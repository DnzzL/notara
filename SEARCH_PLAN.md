# Search Feature Implementation Plan

## Overview
Implement Cmd+K quick search modal with full-text search across page titles AND block content (using SQLite FTS5), recent pages, and keyboard navigation.

## Current State
- `pages_fts` FTS5 table exists but only indexes page titles (content column always empty)
- `searchPages` RPC endpoint exists but only searches page titles via FTS MATCH
- Sidebar has a basic text filter (client-side, title only)
- No Cmd+K modal exists
- No block content search exists

## Files to Create/Modify (in order of dependency)

### 1. Migration: `packages/server/migrations/005_blocks_fts.sql` (CREATE)
Create FTS5 virtual table for blocks content with INSERT/UPDATE/DELETE triggers.

```sql
-- Full-text search on block content
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
  content,
  content='blocks',
  content_rowid='rowid'
);

-- Triggers to keep blocks_fts in sync
CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
  INSERT INTO blocks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
  INSERT INTO blocks_fts(blocks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
  INSERT INTO blocks_fts(blocks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO blocks_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

### 2. Shared Schema: `packages/shared/src/schema.ts` (MODIFY)
Add SearchResult class at the end of the file:

```typescript
export class SearchResult extends Schema.Class<SearchResult>("SearchResult")({
  type: Schema.Literal("page", "block"),
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  pageId: Schema.String,
}) {}
```

### 3. RPC API: `packages/shared/src/api.ts` (MODIFY)
- Import SearchResult from schema
- Replace existing `searchPages` RPC with `globalSearch`:

```typescript
Rpc.make("globalSearch", {
  payload: { query: Schema.String },
  success: Schema.Array(SearchResult),
}),
```

Remove the old `searchPages` Rpc definition entirely.

### 4. Search Handler: `packages/server/src/handlers/search.ts` (CREATE)
New file with the globalSearch handler that queries both FTS tables:

```typescript
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { SearchResult } from "@notion-alt/shared";

// Escape special FTS5 characters
function escapeFtsQuery(q: string): string {
  return q.replace(/["<>~*()]/g, "");
}

export const globalSearch = (query: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const safeQuery = escapeFtsQuery(query.trim());
    if (!safeQuery) return [];

    const results: any[] = [];

    // 1. Search pages by title via FTS
    const pageRows = yield* sql`
      SELECT p.id, p.title, '' as content, p.id as "pageId"
      FROM pages p
      JOIN pages_fts fts ON fts.rowid = p.rowid
      WHERE pages_fts MATCH ${safeQuery} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT 20
    `;
    for (const r of pageRows) {
      results.push(new SearchResult({
        type: "page", id: r.id as string,
        title: r.title as string, content: "",
        pageId: r.pageId as string,
      }));
    }

    // 2. Search blocks by content via FTS, join with pages for title
    const blockRows = yield* sql`
      SELECT b.id, p.title as "pageTitle", b.content, b.page_id as "pageId"
      FROM blocks b
      JOIN blocks_fts fts ON fts.rowid = b.rowid
      JOIN pages p ON b.page_id = p.id
      WHERE blocks_fts MATCH ${safeQuery} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT 30
    `;
    for (const r of blockRows) {
      results.push(new SearchResult({
        type: "block", id: r.id as string,
        title: r.pageTitle as string,
        content: (r.content as string).slice(0, 200),
        pageId: r.pageId as string,
      }));
    }

    return results;
  });
```

### 5. Server Wiring: `packages/server/src/index.ts` (MODIFY)
- Add import: `import * as Search from "./handlers/search.js";`
- In `rpcHandlersLayer`, replace the `searchPages` line with:
  `globalSearch: ({ query }) => Search.globalSearch(query).pipe(Effect.orDie),`

### 6. RPC Client: `packages/app/src/rpc-client.ts` (MODIFY)
- Import `SearchResult` from `@notion-alt/shared`
- Replace `searchPages` method with:
  `globalSearch: (query: string) => rpcCall<SearchResult[]>("globalSearch", { query }),`

### 7. Page Store: `packages/app/src/stores/pageStore.ts` (MODIFY)
- Rename `searchPages` to `globalSearch`:
  ```typescript
  globalSearch: async (query: string) => {
    const results = await api.globalSearch(query);
    set({ searchResults: results });
  },
  ```
- Add `searchResults: SearchResult[]` to PageState interface
- Add `searchResults: []` to initial state

### 8. Store Composition: `packages/app/src/store.ts` (MODIFY)
- Replace `searchPages: pageState.searchPages` with `globalSearch: pageState.globalSearch`
- Add `searchResults: pageState.searchResults`

### 9. SearchModal Component: `packages/app/src/components/SearchModal.tsx` (CREATE)
Full Cmd+K modal component. Key features:

- **Trigger**: `useEffect` with keydown listener for `Meta+K` (macOS) or `Ctrl+K` (Linux/Windows) and `/` when not in input
- **Recent Pages**: Store last-5-visited page IDs in `localStorage` under `notion-alt:recentPages`. On modal open, fetch those pages to show as "Recent" section when query is empty.
- **Search**: Call `api.globalSearch(query)` on each keystroke with 150ms debounce
- **Results Display**: Grouped by type - "Recent" (when empty query), "Pages", "Blocks in Pages"
- **Keyboard Navigation**: Arrow up/down to highlight, Enter to navigate to selected result
- **Block results**: Show page title as primary, block content snippet (first 120 chars) as secondary with matched terms highlighted
- **Click**: Selecting any result navigates to that page via `selectPageByIdWithCascade`
- **Dismiss**: Escape key, clicking backdrop
- **Styling**: Fixed overlay, centered modal ~600px wide, max 400px height with scroll, dark backdrop with blur

Implementation details:
```typescript
// State: isOpen, query, results (SearchResult[]), recentPages (Page[]), selectedIndex
// Refs: inputRef, modalRef
// Debounced search: useRef for timer, useEffect on query changes
// onNavigate: for page results -> selectPageByIdWithCascade(result.pageId)
//              for block results -> same + optionally scroll to block
// localStorage helper: getRecentPageIds(), addRecentPageId(id)
// Call addRecentPageId whenever selectPage/selectPageById is called (wrap in store or component)
```

The modal should be rendered as a portal or at the root level to avoid z-index issues.

### 10. Components Index: `packages/app/src/components/index.ts` (MODIFY)
Add export for SearchModal.

### 11. Main App: `packages/app/src/main.tsx` (MODIFY)
- Import SearchModal
- Add `<SearchModal />` alongside Sidebar and BlockEditor in the App component

### 12. Recent Pages Tracking: `packages/app/src/stores/pageStore.ts` (MODIFY)
In `selectPage` method, add localStorage tracking:
```typescript
// Track recently viewed pages
const recent = JSON.parse(localStorage.getItem("notion-alt:recentPages") || "[]");
const filtered = [id, ...recent.filter((x: string) => x !== id)].slice(0, 5);
localStorage.setItem("notion-alt:recentPages", JSON.stringify(filtered));
```

## Build & Verify Steps
1. Create migration file
2. Modify shared schema + api, rebuild shared: `cd packages/shared && bun run build`
3. Create search handler, wire into server
4. Modify rpc-client, pageStore, store composition
5. Create SearchModal component
6. Wire into main.tsx
7. Kill old server: `lsof -ti:3000 | xargs kill -9 2>/dev/null`
8. Start server: `cd packages/server && bun run dev` (NOT bun run --filter)
9. Start app: `cd packages/app && bun run dev`
10. Verify: Cmd+K opens modal, typing searches pages+blocks, Enter navigates

## Pitfalls
- FTS5 MATCH requires special character escaping - the escapeFtsQuery function is critical
- Must rebuild shared package after modifying RPC schemas (stale dist/ causes runtime errors)
- Use `cd packages/xxx && bun run dev` NOT `bun run --filter` (known duplicate spawn bug)
- Port 3000 may need cleanup between restarts
- The pages_fts trigger currently inserts empty content - this is fine since we only search titles via pages_fts. Block content goes in blocks_fts.
- Block results need to show which PAGE they belong to (via JOIN) since blocks have no standalone route
- Debounce is important to avoid flooding the server with RPC calls on every keystroke
