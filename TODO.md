# Effect Notes - TODO List

## Active

### Database UX polish
- [ ] Keyboard cell navigation (arrows, Tab/Shift+Tab, Enter-to-edit)
- [ ] One-click sort on column header + sort indicator (arrow + index)
- [ ] Column drag-reorder
- [ ] Bulk row select (Shift+click range, Cmd/Ctrl+click toggle, Cmd+A) + Delete with confirm
- [ ] Board view: inline "Add column" tile
- [ ] Basic formula field — `prop("Name")` refs, `+ - * /`, `if`, `sum`, `round`

### Desktop (Phase 5)
- [ ] Electron wrapper (auto-start backend, menu bar, shortcut registration, build pipeline, auto-updater)

### Tests
- [ ] E2E tests for image/PDF upload flow

---

## Done ✅

- Monorepo scaffold with Bun, Effect RPC, SQLite + migrations
- Block types: paragraph, headings, lists, todo, code, quote, divider, image, PDF, callout, toggle, database, pageLink
- Block navigation (arrows, backspace merge, enter split)
- Drag & drop blocks (reorder + cross-page via sidebar)
- Search: `Cmd+K` modal, FTS on titles + block content, recent pages
- Page features: icons (emoji), favorites, recently viewed
- Import: Notion Markdown + CSV. Export: page Markdown, database CSV, ZIP-all
- File attachments: image + PDF upload, drag-drop, paste-from-clipboard, backward-compat
- Keyboard shortcuts: `Cmd+[`/`]`, `Cmd+D`, `Cmd+Shift+↑↓`, `Cmd+Shift+N`
- Database field types: text, number, select, multiSelect, date, checkbox, page, relation
- Inline databases (table + board views), URL-based routing, page title editing
- Playwright E2E (15 tests)

## Deferred / low priority

- Cover images
- Page templates (blank, todo, meeting notes)
- `Cmd+P` quick search shortcut, `Cmd+Shift+P` command palette
- Database templates (todo, wiki, CRM)
- Rollup field (aggregate related records)
- Virtualization (when >200 records becomes a real workload)
- Freeze title column on scroll
- Paste-multi-cell, type-migration warnings
