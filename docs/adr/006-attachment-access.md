# ADR-006: Attachment Access Follows Page Access

**Status:** Accepted
**Date:** 2026-08-26
**Scope:** Authorization for serving uploaded files. Supersedes the access posture implied by ADR-001.

## Context

ADR-001 decided where uploaded files live — on the filesystem under `.data/attachments/`,
named by ULID, served by extending the static file handler — and settled nothing about who
may read them. The static handler was never given a guard, so the answer in the running
code was *anyone*.

Concretely, before this ADR: `GET /attachments/<ulid>.<ext>` required no session. Path
traversal was blocked by a filename pattern; access was not blocked at all. Every uploaded
image and PDF in every workspace was readable by any caller holding the ULID — including a
user removed from the workspace yesterday, a member with no access to the locked page the
file sits on, and anyone the URL was ever pasted to.

The de facto policy was therefore a **capability URL**: possession of an unguessable name
is possession of the file. That is a defensible design — it is what a public CDN does, and
it is what Notion does for genuinely public files. It is not defensible as something nobody
chose, sitting underneath a page-level ACL that users are told controls who sees their
content. A workspace owner who locks a page reasonably expects the images on it to be
locked too.

## Decision

**An attachment is not an independent resource. Its readability is the readability of the
page whose block embeds it.**

Serving an attachment requires a session, and requires that the caller could read the
owning page. Losing access to the page loses access to the file, immediately, with no
separate grant to revoke and no cache to wait out.

### Recovering the workspace

The serving route is reached by `<img src>` and `<embed src>`. Those cannot set the
`X-Workspace-Id` header every other authenticated route relies on, and the URL stored in
block content is a bare `/attachments/<ulid>.<ext>` written long before any of this. So the
workspace is **recovered rather than declared**: the attachment id is looked for in the
workspaces the caller is a member of, stopping at the first hit.

This was chosen over the alternatives because it needs no schema change, no backfill, and
no rewriting of URLs already embedded in stored block content:

- *Put the workspace in the URL* — requires migrating every attachment URL inside existing
  block content, and breaks any URL already in the wild.
- *Index attachment id to workspace in the platform database* — one lookup instead of a
  short scan, but needs a new table, a write on upload, and a backfill across every
  workspace database for installs that already have attachments.
- *Trust a query parameter* — the app would have to rewrite `src` at render time, and the
  parameter would still have to be verified against membership, so it saves nothing.

The scan is safe and bounded. Attachment ids are ULIDs, unique across every workspace, so
at most one workspace can hold a given one. Only the caller's own workspaces are searched,
so a miss reveals nothing about whether the file exists elsewhere. Workspace layers are
cached in-process, so the cost is one indexed primary-key lookup per workspace the caller
belongs to, short-circuiting on the first hit — a number that is 1 to 3 for essentially
every self-hosted install.

If that ever stops being true, the platform-level index is the optimisation, and it can be
added behind the same interface without touching callers.

### Miss versus denial

A file in no workspace of the caller's is a **404**, decided before the disk is touched, so
an unreadable attachment is indistinguishable from a missing one. A file found in a
workspace the caller belongs to but on a page they cannot read is a **403** — they are a
member, they simply cannot see that page, and saying so leaks nothing they did not already
know.

## Consequences

**Positive**
- Locking a page locks its images and PDFs. The ACL means what users think it means.
- Removing someone from a workspace removes their access to its files, at once.
- Attachment URLs stop being bearer tokens that cannot be revoked.

**Negative**
- **Attachment URLs no longer work outside an authenticated session.** In practice this
  costs little: the URLs are relative and only ever resolved by the app in a cookie-bearing
  same-origin request. Nothing in the repository depends on fetching one anonymously.
  Anyone who pasted such a URL into a chat or a bookmark will find it stops working.
- Serving a file now costs a session lookup and one or more indexed queries. Acceptable at
  mono-instance scale; see the note on the platform index above.
- Public page sharing, if it lands (NOT-42, NOT-43), must extend this check rather than
  bypass it — a publicly shared page's attachments have to become publicly readable through
  the same resolution, not through a hole punched around it.

## Amendment (NOT-42) — public page sharing

Sharing landed, and it extends this check rather than bypasses it, as required above.

A share token stands in for a session. It does not weaken the rule that an attachment is
readable exactly when its page is; it supplies a different reader. What it adds is a
narrowing, because a token grants **one page**: `GET /api/public/pages/:token/attachments/:fileName`
serves a file only when that file's `page_id` is the page the token published. A token is
therefore not a key to the workspace's uploads, and the authenticated
`GET /attachments/:fileName` route is unchanged — a stranger still gets 401 there.

The publisher's own access is re-checked on every read, so locking a page cuts its images
as surely as it cuts its text. See `packages/server/src/handlers/public-page.ts`.

## Related

- Supersedes the access posture left unstated by ADR-001, whose storage decisions stand.
- Fixes the gap found in the pre-release architecture review alongside NOT-102.
- The composable Policy work (NOT-104) will express this as a declarative rewrite rule
  rather than a bespoke resolver; this ADR's decision survives that change unaltered.
