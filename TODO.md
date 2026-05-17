# Effect Notes - TODO List

## P0 - Core Experience (Priority)

### 1. Complete Block Types

- [x] Add quote block (`/quote`)

- [x] Add callout block (`/callout`) with emoji

- [x] Add divider block (`/divider`)

- [x] Add image embed block (`/image`)

- [x] Add todo/checkbox block (`/todo`)

- [x] Add toggle block (`/toggle`)

### 2. Block Navigation

- [x] Arrow keys navigate between blocks

- [x] Backspace at start merges with previous block

- [x] Enter splits current block

- [x] Delete empty block when backspace on empty

### 3. Drag & Drop Blocks

- [x] Drag handle on blocks

- [x] Reorder blocks within page

- [x] Drop indicator between blocks

- [x] Drag to sidebar to move to another page

---

## P1 - Polish

### 4. Search

- [x] `Cmd+K` quick search modal

- [x] Full-text search in page titles

- [x] Full-text search in block content (use FTS)

- [x] Recent pages in search

- [x] Navigate to result on Enter

### 5. Page Features

- [ ] Page icons (emoji picker)

- [ ] Cover images (upload or URL)

- [ ] Favorite/starred pages

- [x] Recently viewed pages

- [ ] Page templates (blank, todo, meeting notes)

### 6. Import/Export

- [ ] Import Notion Markdown export

- [ ] Import Notion CSV databases

- [ ] Export page as Markdown

- [ ] Export database as CSV

- [ ] Export all as ZIP

---

## P2 - Desktop

### 7. Electron App

- [ ] Electron wrapper

- [ ] Auto-start backend server

- [ ] Menu bar (File, Edit, View)

- [ ] Keyboard shortcuts registration

- [ ] Auto-updater

- [ ] Single executable build

### 8. File Attachments

- [ ] Upload images/files

- [ ] Store in local filesystem

- [ ] Embed images in blocks

- [ ] File viewer for PDFs

---

## P3 - Advanced

### 9. Database Templates

- [ ] Todo database template

- [ ] Wiki/Documentation template

- [ ] CRM/Contacts template

- [ ] Custom templates

### 10. Keyboard Shortcuts

- [ ] `Cmd+[` / `Cmd+]` - History back/forward

- [ ] `Cmd+D` - Duplicate block

- [ ] `Cmd+Shift+↑↓` - Move block up/down

- [ ] `Cmd+Shift+N` - New page

- [ ] `Cmd+P` - Quick search

- [ ] `Cmd+Shift+P` - Command palette

### 11. Database Field Types

- [ ] Select field with options

- [ ] Multi-select field

- [ ] Date field with picker

- [ ] Checkbox field

- [ ] Number field with sorting

- [ ] Relation field (link to another database)

- [ ] Rollup field (aggregate related records)

---

## Done ✅

- [x] Monorepo scaffold with Bun

- [x] Effect RPC type-safe API

- [x] SQLite with migrations

- [x] TipTap block editor

- [x] Slash menu (`/` for blocks)

- [x] Nested pages with sidebar tree

- [x] Inline databases (table/board)

- [x] URL-based page routing

- [x] Page title editing

- [x] Database CRUD (fields, records, views)

- [x] Playwright E2E tests