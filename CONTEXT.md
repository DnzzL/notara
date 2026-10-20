# Notara — Domain Glossary

The vocabulary the code speaks, defined as it is actually used rather than as it ideally
would be. Where a term carries two meanings, that is said out loud: those collisions are
what a newcomer trips on, and smoothing them over here would only move the trip further in.

Architecture lives in `CLAUDE.md`; decisions live in `docs/adr/`. This file is the
dictionary.

---

## Container

**Workspace** — the top-level container and the unit of isolation. Each workspace has its
own SQLite database file; users, sessions, workspaces and membership live in a separate
*platform* database shared by all of them. Almost every API call names a workspace, by an
`X-Workspace-Id` header on RPC or a path segment on REST.

**Workspace member** — a user who belongs to a workspace, with role `owner` or `member`.
Membership is the precondition for everything: a non-member is refused before any resource
is consulted. One query answers it, in `membership.ts`.

> ⚠️ **"owner" means three different things.** The workspace *role* `owner`, held in
> `workspace_members`; the ACL *relation* `owner` on a page; and `workspaces.owner_id`, the
> user who created the workspace. The first two are related but not identical — a workspace
> owner resolves to the `owner` relation on every page without any ACL entry existing. The
> third is a separate column, and it is the one to be careful with: it is the source of
> truth for "who created this" (refusing to remove them, and finding whose account to purge
> with an expired demo workspace), *not* for whether someone currently holds the owner role.
> The two can disagree, and authorization reads the role, never the column.

> ⚠️ **"member" means two things.** The workspace role, and the userset half of the ACL
> subject `workspace:<id>#member`, which addresses *all* members of a workspace at once.

---

## Content

**Page** — a document. Pages form a tree through `parentId`, and that tree is what the
sidebar shows and what ACL inheritance walks. A page carries a title, an icon, a cover and
a favourite flag.

**Block** — one unit of content inside a page: a paragraph, a heading, a to-do, an image, an
embedded database, and so on (`Block.type`). Blocks are ordered within their page by
`index`, and may nest through their own `parentId`.

> ⚠️ **Ordering is spelled two ways.** Blocks use `index`; pages, databases, fields and
> views use `sortOrder`. Same concept, two names, for historical reasons — do not assume
> one when reading the other.

**Attachment** — an uploaded image or PDF. The file sits on disk named by ULID; the database
keeps only metadata and the owning page. An attachment is not independently shareable: it is
readable exactly when its page is (ADR-006).

**Backlink** — a block on some page that references another page, listed on the referenced
page. Derived, never stored as its own record.

---

## Databases

**Database** — a Notion-style database: a named collection of records with typed fields,
living on a page.

> ⚠️ **"database" means three things.** The domain entity here; the `database` *block type*,
> which embeds one in a page; and the SQLite *file* backing a workspace. Context usually
> disambiguates, but the block type and the entity appear in the same files.

**Field** — a typed column: `text`, `number`, `select`, `multiSelect`, `date`, `checkbox`,
`relation`, `page`, `formula`, `people`. Adding one is currently an edit in roughly
eighteen places — see NOT-113 through NOT-117, which is the work to make it one.

> ⚠️ **"relation" means two things.** A *field type* pointing at another database
> (`relationTargetDbId`), and an *ACL relation* (`owner` / `editor` / `viewer`). Unrelated
> concepts, same word, both in the server.

> ⚠️ **The `page` field type is a page link**, labelled "Page link" in the picker. It is not
> "the page this record lives on" — that is `DatabaseRecord.pageId`.

**Record** — a row. A record may open as its own page (`DatabaseRecord.pageId`); when it
does, that page *is* the record's detail view, not a separate document beside it. Creating a
standalone page alongside a record produces duplicates.

**Record field value** — one cell, stored as a string. Every field type encodes into and
decodes out of that string; multi-value types use JSON.

**View** — a saved way of looking at a database: `table`, `board` or `calendar`, with
grouping, sorting and a `config` blob holding filters and column state. Exactly one view per
database is marked default; promoting one demotes the previous.

**Saved view** — the persisted `View`, as opposed to the unsaved state the UI is currently
showing. The UI tracks whether the two have diverged; that difference is what "dirty" means
on a view.

**View reference** — a block type embedding a saved view of a database that lives elsewhere.

---

## Access

Access control is Zanzibar-shaped. Read ADR-007 before changing any of it.

**Relation** — what a subject holds on a resource: `owner`, `editor` or `viewer`. Stronger
implies weaker; there is no numeric ranking, only declared implication.

**Tuple** — one stored grant: a resource, a relation, and a subject. Storage enforces at most
one relation per subject per resource.

**Subject** — who a grant addresses. Exactly one of a user (`user:<id>`), the userset of all
members of a workspace (`workspace:<id>#member`), or `public`, meaning anyone with the link.

**Locked page** — a page carrying any tuples at all. This is the load-bearing term: the
nearest ancestor bearing tuples answers for its whole subtree *exclusively*, so placing a
single grant on a page privatises it without naming everyone excluded. A member with no
matching tuple there is refused, and the walk does not continue upward. This is a deliberate
departure from the Zanzibar paper — ADR-007 explains what it buys and what it costs.

**Effective relation** — what a caller ends up holding on a page once membership, the
workspace-owner shortcut, and the nearest lock have all been consulted.

**Revision** — a per-resource counter bumped on every ACL write, used as an optimistic
concurrency token. The Zanzibar paper calls it a *zookie*; the code calls it a revision.

**Policy** — an authorization decision as a value: an Effect that succeeds when access is
granted and fails with `AuthError` when it is not. Policies compose (`all`, `any`) and
attach to an operation with `withPolicy`. The vocabulary lives in `policies.ts`.

**Principal** — the authenticated caller, resolved from a session cookie or an API key.
Available as `CurrentUser`.

**Instance admin** — the one authorization axis that is not a relation to a resource: a
configured list of email addresses in `ADMIN_EMAILS`, gating the admin routes. See ADR-008
for why there is no wider permission vocabulary.

---

## Elsewhere

**Presence** — who else is on a page right now, and which block they hold a lock on.
In-process and mono-instance by design.

**Template** — a built-in starter structure a user can instantiate as pages and databases.
A static catalogue in the server, not workspace data.

**Demo workspace** — an ephemeral workspace created for a visitor trying the hosted
instance, purged on a schedule.

**Import** — reading a Notion export into a workspace. Not currently idempotent: re-running
clones rather than updates (NOT-109).

**Backup** — a periodic archive of a workspace's database and attachments, written to S3.
Restoring one exits the process and relies on the orchestrator to restart it.
