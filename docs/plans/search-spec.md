# Search Feature — Detailed Spec (Cmd+K Quick Search)

## Overview

Implement a Notion-style `Cmd+K` (or `Ctrl+K`) quick search modal that searches across page titles AND block content using SQLite FTS5, shows recent pages when the query is empty, and navigates to the selected result on Enter.

## Current State

### What Already Exists
- **Server FTS**: `pages_fts` FTS5 virtual table on `pages` table, indexes `title` and `content` columns. Currently only `title` is populated; `content` is always empty (see migration `001_initial.sql` lines 74-78).
- **Server searchPages handler**: `packages/server/src/handlers/pages.ts` line 89-105 — queries `pages_fts` with MATCH, returns up to 50 pages ranked by relevance.
- **RPC schema**: `packages/shared/src/api.ts` line 34-37 — `searchPages` RPC already defined, takes `{ query: string }`, returns `Page[]`.
- **RPC client**: `packages/app/src/rpc-client.ts` line 61 — `searchPages(query)` already wired up.
- **Page store**: `packages/app/src/stores/pageStore.ts` line 127-130 — `searchPages` method exists but replaces the entire `pages` list (meant for sidebar filter, not a modal).
- **Sidebar search**: `packages/app/src/components/Sidebar.tsx` line 59, 72-76 — basic client-side `includes()` filter on page titles.
- **PageReferenceMenu**: `packages/app/src/components/PageReferenceMenu.tsx` — existing autocomplete popup pattern for `[[` mentions. Useful UI reference.

### What's Missing
- No FTS index on block content (blocks table has no FTS virtual table)
- No Cmd+K keyboard shortcut handler
- No search modal component
- No "recently viewed pages" tracking
- No search UI that combines page titles + block content results

---

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────┐
│  Frontend: SearchModal.tsx                  │
│  - Cmd+K / Ctrl+K opens modal               │
│  - Text input with debounced search         │
│  - Shows "Recent" when empty                │
│  - Shows grouped results when typing        │
│  - Arrow key nav + Enter to select          │
│  - ESC to close                             │
├─────────────────────────────────────────────┤
│  RPC: searchPages (already exists)          │
│  - Extended to accept optional limit param  │
├─────────────────────────────────────────────┤
│  Server: searchPages handler                │
│  - Queries pages_fts (title FTS)            │
│  - Queries blocks_fts (content FTS)         │
│  - Combines and ranks results               │
├─────────────────────────────────────────────┤
│  SQLite: FTS5 virtual tables                │
│  - pages_fts (exists, already indexes title)│
│  - blocks_fts (NEW migration needed)        │
└─────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Add FTS5 Index for Block Content

**File**: `packages/server/migrations/002_blocks_fts.sql` (NEW)

Create an FTS5 virtual table for blocks and set up INSERT/UPDATE/DELETE triggers to keep it in sync.

```sql
-- Full-text search on block content
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
  content,
  content='blocks',
  content_rowid='rowid'
);

-- Trigger: INSERT
CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
  INSERT INTO blocks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Trigger: UPDATE
CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
  INSERT INTO blocks_fts(blocks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO blocks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Trigger: DELETE
CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
  INSERT INTO blocks_fts(blocks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
```

**Verify**: The migration runs on server startup. Existing blocks will need a one-time population step — add a reindex call in the server startup or provide a manual SQL: `INSERT INTO blocks_fts(rowid, content) SELECT rowid, content FROM blocks;`

---

### Task 2: Extend searchPages Server Handler

**File**: `packages/server/src/handlers/pages.ts`

Modify `searchPages` to:
1. Query `pages_fts` for matching page titles (existing)
2. Query `blocks_fts` for matching block content (NEW)
3. For block matches, fetch the parent page info
4. Combine results, deduplicate by page ID, rank by relevance
5. Return combined results with a `matchType` field: `"title"` or `"content"`
6. Highlight matched text snippets from block content

**Extended return shape**: The existing RPC returns `Page[]`. We need to extend this to return richer results. Two options:
- **Option A (simpler)**: Keep returning `Page[]`, but add a new RPC `search` that returns enriched results.
- **Option B (better)**: Create a new `SearchResult` schema in `packages/shared/src/schema.ts` and a new `search` RPC.

**Go with Option B** — create a new RPC endpoint to avoid breaking the existing `searchPages` contract.

#### New Schema in `packages/shared/src/schema.ts`:

```typescript
export class SearchResult extends Schema.Class<SearchResult>("SearchResult")({
  pageId: Schema.String,
  pageTitle: Schema.String,
  pageIcon: Schema.NullOr(Schema.String),
  matchType: Schema.Literal("title", "content"),
  // For content matches: snippet of matching block text
  snippet: Schema.NullOr(Schema.String),
  // For content matches: block type that matched
  blockType: Schema.NullOr(Schema.String),
  rank: Schema.Number,
}) {}
```

#### New RPC in `packages/shared/src/api.ts`:

```typescript
Rpc.make("search", {
  payload: {
    query: Schema.String,
    limit: Schema.Number.pipe(Schema.optionalWith({ default: () => 20 })),
  },
  success: Schema.Array(SearchResult),
}),
```

#### New Handler in `packages/server/src/handlers/pages.ts`:

```typescript
export const search = (query: string, limit: number = 20) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // 1. Search page titles via FTS
    const pageResults = yield* sql`
      SELECT p.id as "pageId", p.title as "pageTitle", p.icon as "pageIcon",
             'title' as "matchType", NULL as "snippet", NULL as "blockType",
             fts.rank as "rank"
      FROM pages p
      JOIN pages_fts fts ON fts.rowid = p.rowid
      WHERE pages_fts MATCH ${query} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT ${limit}
    `;

    // 2. Search block content via FTS
    const blockResults = yield* sql`
      SELECT p.id as "pageId", p.title as "pageTitle", p.icon as "pageIcon",
             'content' as "matchType",
             b.content as "snippet", b.type as "blockType",
             fts.rank as "rank"
      FROM blocks b
      JOIN blocks_fts fts ON fts.rowid = b.rowid
      JOIN pages p ON p.id = b.page_id
      WHERE blocks_fts MATCH ${query} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT ${limit}
    `;

    // 3. Combine and deduplicate (prefer title matches over content matches)
    const combined = [...pageResults, ...blockResults];
    const seen = new Set<string>();
    const deduped: typeof combined = [];
    for (const r of combined) {
      const key = r.pageId;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(r);
      } else if (r.matchType === 'content' && deduped.find(d => d.pageId === r.pageId)?.matchType === 'title') {
        // Keep the title match but append snippet info
        const existing = deduped.find(d => d.pageId === r.pageId);
        if (existing && !existing.snippet) {
          existing.snippet = r.snippet;
          existing.blockType = r.blockType;
        }
      }
    }

    return deduped.slice(0, limit);
  });
```

#### Wire Up in Server Index

**File**: `packages/server/src/index.ts`

Add the new handler to the RPC router:
```typescript
search: ({ query, limit }) => Pages.search(query, limit).pipe(Effect.orDie),
```

#### Add RPC Client Method

**File**: `packages/app/src/rpc-client.ts`

Add:
```typescript
search: (query: string, limit?: number) => rpcCall<SearchResult[]>("search", { query, limit }),
```

Also import `SearchResult` from `@notara/shared`.

---

### Task 3: Create SearchModal Component

**File**: `packages/app/src/components/SearchModal.tsx` (NEW)

A centered modal overlay with:
- **Input field** at top with search icon
- **Results list** below, grouped by type:
  - When query is empty: show "Recent" section (recently viewed pages)
  - When query has text: show grouped results — "Pages" (title matches) first, then "In content" (block matches)
- **Keyboard navigation**: ArrowUp/ArrowDown to move selection, Enter to open, Escape to close
- **Mouse interaction**: Click result to navigate, hover highlights

**Component signature**:
```typescript
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**SearchResult type** (from shared schema):
```typescript
interface SearchResult {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  matchType: "title" | "content";
  snippet: string | null;
  blockType: string | null;
  rank: number;
}
```

**Behavior**:
1. On open with empty query: Show "Recent" pages (stored in localStorage, last 10 viewed page IDs)
2. On typing (debounced 150ms): Call `api.search(query, 20)`, display results
3. On Enter: Navigate to selected page via `selectPageByIdWithCascade(pageId)`, close modal
4. On Escape: Close modal
5. On click outside: Close modal

**Recent pages tracking**:
- Use `localStorage` key `notara:recent-pages` storing JSON array of `{ pageId, pageTitle, viewedAt }`
- Update this list whenever a page is selected (add `selectPage` calls in pageStore or in main App)
- On modal open with empty query, fetch these page details and show them

**UI Layout**:
```
┌──────────────────────────────────────────┐
│  🔍 [search input text here............] │
├──────────────────────────────────────────┤
│  PAGES                                   │
│  📄 Engineering Notes                    │
│  🗒️  Meeting Template                    │
├──────────────────────────────────────────┤
│  IN CONTENT                              │
│  📄 Project Plan                         │
│     "...the deployment schedule for..."  │
│  📄 Architecture Doc                     │
│     "...uses SQLite FTS for full-text..."│
└──────────────────────────────────────────┘
```

**CSS classes** (add to `styles.css`):
```css
/* Search Modal */
.search-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  z-index: 1000;
}

.search-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  width: 560px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-modal-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e9e9e7;
  gap: 10px;
}

.search-modal-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  background: transparent;
}

.search-modal-results {
  overflow-y: auto;
  max-height: calc(60vh - 60px);
  padding: 8px 0;
}

.search-modal-section-header {
  padding: 6px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.search-modal-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.search-modal-item:hover,
.search-modal-item.selected {
  background: #f7f6f3;
}

.search-modal-item .icon {
  font-size: 16px;
  flex-shrink: 0;
}

.search-modal-item .title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-query: ellipsis;
}

.search-modal-item .snippet {
  font-size: 12px;
  color: #888;
  margin-left: 26px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-modal-item .match-type {
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.search-modal-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
```

---

### Task 4: Wire Up Cmd+K Shortcut and Recent Pages

**File**: `packages/app/src/main.tsx`

Add a `useEffect` that registers the `Cmd+K` / `Ctrl+K` keyboard shortcut at the app level:

```typescript
const [searchOpen, setSearchOpen] = useState(false);

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(prev => !prev);
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, []);
```

Render `<SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />` inside the App.

**Recent Pages**: Add a `recordPageView(pageId: string)` utility that stores to localStorage. Call it from `selectPage` in the page store. Use a max of 10 entries, LRU-style (most recent first, remove duplicates).

**File**: `packages/app/src/utils/recentPages.ts` (NEW)

```typescript
interface RecentPage {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  viewedAt: number;
}

const STORAGE_KEY = "notara:recent-pages";
const MAX_RECENT = 10;

export function getRecentPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPageView(pageId: string, pageTitle: string, pageIcon: string | null) {
  const recent = getRecentPages();
  // Remove existing entry for this page
  const filtered = recent.filter(r => r.pageId !== pageId);
  // Add to front
  filtered.unshift({ pageId, pageTitle, pageIcon, viewedAt: Date.now() });
  // Trim
  const trimmed = filtered.slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}
```

Call `recordPageView` from `selectPage` in `pageStore.ts`:
```typescript
import { recordPageView } from "../utils/recentPages.js";

selectPage: (page) => {
  set({ currentPage: page });
  recordPageView(page.id, page.title, page.icon);
  // ... rest of URL update
}
```

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `packages/server/migrations/002_blocks_fts.sql` | FTS5 virtual table for blocks + triggers |
| MODIFY | `packages/shared/src/schema.ts` | Add `SearchResult` schema class |
| MODIFY | `packages/shared/src/api.ts` | Add `search` RPC to AppRpc group |
| MODIFY | `packages/server/src/handlers/pages.ts` | Add `search()` handler combining page+block FTS |
| MODIFY | `packages/server/src/index.ts` | Wire `search` handler to RPC router |
| MODIFY | `packages/server/src/mappers.ts` | Add mapper for SearchResult rows if needed |
| MODIFY | `packages/app/src/rpc-client.ts` | Add `search()` client method + import SearchResult |
| CREATE | `packages/app/src/utils/recentPages.ts` | Recent pages localStorage utility |
| CREATE | `packages/app/src/components/SearchModal.tsx` | Cmd+K search modal component |
| MODIFY | `packages/app/src/stores/pageStore.ts` | Call `recordPageView` in `selectPage` |
| MODIFY | `packages/app/src/main.tsx` | Add Cmd+K listener + render SearchModal |
| MODIFY | `packages/app/src/styles.css` | Add search modal CSS classes |

---

## Verification Steps

1. **Migration**: Server starts without errors, `blocks_fts` table exists
2. **Block FTS population**: After server restart, existing blocks are indexed (check with `SELECT count(*) FROM blocks_fts`)
3. **RPC**: `curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d '{"_tag":"Request","id":"1","tag":"search","payload":{"query":"hello"}}'` returns results
4. **Modal**: Press Cmd+K — modal appears with recent pages
5. **Search**: Type text — results appear from both titles and block content
6. **Navigation**: Arrow keys navigate results, Enter opens page
7. **Close**: Escape closes modal, clicking outside closes modal
8. **Recent pages**: After visiting pages, they appear in empty-search view

---

## Notes

- Use `little-coder` for implementation. The codebase uses Effect, SQLite FTS5, zustand, and plain CSS.
- No external search library needed — SQLite FTS5 is sufficient.
- Keep the modal lightweight — no cmdk library, build from scratch like the existing SlashMenu and PageReferenceMenu patterns.
- The `searchPages` existing RPC should NOT be modified. Create a new `search` RPC to keep contracts clean.
- Block content search should return the parent page, not the block itself (users navigate to pages, not individual blocks).
- Snippet text should be truncated to ~100 chars with `...` prefix/suffix.
