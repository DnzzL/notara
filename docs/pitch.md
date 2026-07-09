# Effect Notes - Minimalist Notion Alternative

## Vision
A local-first, desktop Notion alternative with block editing, nested pages, table/board database views, and relations — built entirely in Effect TS.

## Architecture

### Desktop Shell
- **Electron** - Main process runs Effect Platform Node server, renderer is React SPA
- Single SQLite file, portable, no cloud, no sync

### Backend
- **Effect Platform Node** HTTP server
- **Effect SQL SQLite** (via better-sqlite3)
- Type-safe RPC via Effect RPC

### Frontend
- **React 19** + **Effect Atom** (reactive state)
- **Effect RPC** for type-safe client→server calls
- **Tiptap** (ProseMirror) for block editor
- **@ark-ui/react** + **Tailwind CSS** for UI components
- **@dnd-kit** for drag-and-drop board views

## Tech Stack

| Layer | Package | Why |
|-------|---------|-----|
| Core | effect | Error handling, dependency injection, RPC |
| Backend HTTP | @effect/platform + @effect/platform-node | Server, routing, file serving |
| Database | @effect/sql + @effect/sql-sqlite-bun | SQL toolkit with migrations |
| RPC | @effect/rpc + @effect/rpc-http | Type-safe client→server calls |
| Frontend state | zustand | Simple state management |
| Block editor | @tiptap/react + @tiptap/starter-kit | ProseMirror-based block editor |
| DnD | @dnd-kit/core + @dnd-kit/sortable | Drag-and-drop for Kanban |
| Desktop | electron (planned) | Native app packaging |
| UI | @ark-ui/react + Tailwind | Accessible, composable components |

## Key Decisions

1. **Single SQLite file** — no Postgres, no Docker, just a .db file
2. **Effect RPC** — type-safe client↔server, single source of truth
3. **Tiptap** — proven block editor, don't reinvent contenteditable
4. **Local-first** — no cloud sync, fully offline capable
5. **Use @tiptap / @ark-ui components — don't reinvent the wheel**
   - Editor features: always check if @tiptap has an extension before building custom
   - UI widgets (menus, dialogs, popovers, tabs, etc.): use @ark-ui/react headless components
   - Only build custom components when neither library covers the need

## Explicitly Out of Scope (YAGNI)

- Real-time collaboration (no CRDT, no WebSockets)
- Calendar/gallery views
- Formula fields
- Comments/mentions
- Mobile app
- Cloud sync

## Milestones

| Phase | What you get | Status |
|-------|-------------|--------|
| 1. Scaffold | Monorepo, types, RPC protocol, SQLite schema | ✅ Done |
| 2. Backend | Full CRUD via Effect RPC, FTS search | ✅ Done |
| 3. Frontend | Sidebar, block editor, page tree | ✅ Done |
| 4. Databases | Table/board views, fields, records | ✅ Done |
| 5. Desktop | Electron wrapper, auto-start server | TODO |
| 6. Import | Notion Markdown → blocks, CSV → databases | TODO |
| 7. File Attachments | Image + PDF upload, storage, inline rendering | TODO |

## Current State

- ✅ Bun monorepo with Effect TS
- ✅ SQLite with migrations
- ✅ Type-safe RPC (Effect RPC)
- ✅ React frontend with Vite
- ✅ Slash commands (/ for blocks)
- ✅ All block types: heading, quote, callout, divider, todo, toggle, image, bullet, numbered, code, database
- ⏳ Image/PDF upload (in design — ADR-001)
- ✅ Nested pages with tree sidebar
- ✅ Inline databases (table/board views)
- ✅ URL-based page routing (?page=id)
- ✅ Page title editing
- ✅ Block persistence (TipTap)
- ✅ Playwright E2E tests (15 passing)

## Running

```bash
# Dev servers
bun run dev:server  # API on :3000
bun run dev:app     # Vite on :5173

# Tests
npx playwright test
```
