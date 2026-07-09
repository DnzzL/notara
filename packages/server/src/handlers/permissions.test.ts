import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import { Database } from "bun:sqlite";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlClient } from "@effect/sql";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PlatformDb } from "../platform-db.js";
import * as Permissions from "./permissions.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "permissions-test-"));
}

function makePlatformDb(tmpDir: string) {
  const db = new Database(path.join(tmpDir, "platform.db"));
  db.exec(`
    CREATE TABLE workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','member')),
      PRIMARY KEY (workspace_id, user_id)
    )
  `);
  return db;
}

function makeWorkspaceLayer(tmpDir: string) {
  const filename = path.join(tmpDir, "workspace.db");
  const db = new Database(filename);
  db.exec(`
    CREATE TABLE pages (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES pages(id) ON DELETE SET NULL
    );
    CREATE TABLE acl_tuples (
      resource_type TEXT NOT NULL,
      resource_id   TEXT NOT NULL,
      subject       TEXT NOT NULL,
      relation      TEXT NOT NULL,
      PRIMARY KEY (resource_type, resource_id, subject)
    );
    CREATE INDEX idx_acl_resource ON acl_tuples(resource_type, resource_id);
    CREATE TABLE acl_revisions (
      resource_type TEXT NOT NULL,
      resource_id   TEXT NOT NULL,
      revision      INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (resource_type, resource_id)
    );
  `);
  db.close();
  return SqliteClient.layer({ filename });
}

function run<A>(
  eff: Effect.Effect<A, unknown, Permissions.PermissionsDeps>,
  platformDb: Database,
  workspaceLayer: ReturnType<typeof makeWorkspaceLayer>,
) {
  return Effect.runPromise(
    eff.pipe(
      Effect.provide(workspaceLayer),
      Effect.provide(Layer.succeed(PlatformDb, platformDb)),
    ),
  );
}

function runExit<A>(
  eff: Effect.Effect<A, unknown, Permissions.PermissionsDeps>,
  platformDb: Database,
  workspaceLayer: ReturnType<typeof makeWorkspaceLayer>,
) {
  return Effect.runPromise(
    Effect.exit(eff).pipe(
      Effect.provide(workspaceLayer),
      Effect.provide(Layer.succeed(PlatformDb, platformDb)),
    ),
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS = "ws-1";
const OWNER = "owner-1";
const MEMBER = "member-1";
const OUTSIDER = "outsider-1";
const PAGE = "page-1";
const CHILD = "child-1";
const GRANDCHILD = "grandchild-1";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Permissions.checkPagePermission", () => {
  let tmpDir: string;
  let platformDb: Database;
  let workspaceLayer: ReturnType<typeof makeWorkspaceLayer>;

  beforeEach(() => {
    tmpDir = makeTempDir();
    platformDb = makePlatformDb(tmpDir);
    workspaceLayer = makeWorkspaceLayer(tmpDir);

    // Seed workspace members
    platformDb
      .prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)")
      .run(WS, OWNER, "owner");
    platformDb
      .prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)")
      .run(WS, MEMBER, "member");

    // Seed a page (open, no ACL entries)
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(PAGE, null);
    wsDb.close();
  });

  afterEach(() => {
    platformDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Behavior 1: open page — workspace member can view
  it("allows workspace member to view an open page", async () => {
    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, PAGE, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Success");
  });

  // Behavior 2: non-member is denied
  it("denies non-workspace-member", async () => {
    const exit = await runExit(
      Permissions.checkPagePermission(OUTSIDER, WS, PAGE, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });

  // Behavior 3: workspace owner always allowed
  it("always allows workspace owner, even on a locked page", async () => {
    // Lock the page with only MEMBER
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'viewer', ?)",
      )
      .run(PAGE, `user:${MEMBER}`);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(OWNER, WS, PAGE, "owner"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Success");
  });

  // Behavior 4: member denied on locked page they're not listed in
  it("denies member on locked page they have no entry for", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'viewer', ?)",
      )
      .run(PAGE, "user:someone-else");
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, PAGE, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });

  // Behavior 5: explicit viewer entry grants access
  it("allows member with explicit viewer entry on a locked page", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'viewer', ?)",
      )
      .run(PAGE, `user:${MEMBER}`);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, PAGE, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Success");
  });

  // Behavior 6: editor relation satisfies viewer check
  it("allows editor to pass a viewer check (hierarchy: editor ⊇ viewer)", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)",
      )
      .run(PAGE, `user:${MEMBER}`);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, PAGE, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Success");
  });

  // Behavior 7: viewer cannot pass editor check
  it("denies viewer-only member when editor is required", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'viewer', ?)",
      )
      .run(PAGE, `user:${MEMBER}`);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, PAGE, "editor"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });

  // Behavior 8: child inherits locked parent's ACL
  it("denies member on child page when locked parent excludes them", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    // Lock the parent page (only "someone-else" has access)
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)",
      )
      .run(PAGE, "user:someone-else");
    // Add child page under PAGE with no ACL entries
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(CHILD, PAGE);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, CHILD, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });

  it("allows member on child page when locked parent grants them access", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)",
      )
      .run(PAGE, `user:${MEMBER}`);
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(CHILD, PAGE);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, CHILD, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Success");
  });

  it("requireWorkspaceOwner allows workspace owner", async () => {
    const exit = await runExit(
      Permissions.requireWorkspaceOwner(OWNER, WS),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Success");
  });

  it("requireWorkspaceOwner denies workspace member", async () => {
    const exit = await runExit(
      Permissions.requireWorkspaceOwner(MEMBER, WS),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });

  it("requireWorkspaceOwner denies non-member", async () => {
    const exit = await runExit(
      Permissions.requireWorkspaceOwner(OUTSIDER, WS),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });

  // Bonus: grandchild inherits from grandparent
  it("propagates ACL through multiple levels (grandchild inherits grandparent lock)", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare(
        "INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)",
      )
      .run(PAGE, "user:someone-else");
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(CHILD, PAGE);
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(GRANDCHILD, CHILD);
    wsDb.close();

    const exit = await runExit(
      Permissions.checkPagePermission(MEMBER, WS, GRANDCHILD, "viewer"),
      platformDb,
      workspaceLayer,
    );
    expect(exit._tag).toBe("Failure");
  });
});

// ── filterPagesByPermission ───────────────────────────────────────────────────

function makePage(id: string, parentId: string | null) {
  return { id, parentId, title: "", icon: null, coverUrl: null, sortOrder: 0, isDeleted: false, isFavorite: false, createdAt: "", updatedAt: "", deletedAt: null };
}

function runWorkspace<A>(
  eff: Effect.Effect<A, unknown, SqlClient.SqlClient>,
  workspaceLayer: ReturnType<typeof makeWorkspaceLayer>,
) {
  return Effect.runPromise(eff.pipe(Effect.provide(workspaceLayer)));
}

describe("Permissions.filterPagesByPermission", () => {
  let tmpDir: string;
  let workspaceLayer: ReturnType<typeof makeWorkspaceLayer>;

  beforeEach(() => {
    tmpDir = makeTempDir();
    workspaceLayer = makeWorkspaceLayer(tmpDir);

    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    // PAGE = root, open
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(PAGE, null);
    // CHILD = under PAGE, also open
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(CHILD, PAGE);
    // GRANDCHILD = under CHILD, open
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(GRANDCHILD, CHILD);
    wsDb.close();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const pages = () => [
    makePage(PAGE, null),
    makePage(CHILD, PAGE),
    makePage(GRANDCHILD, CHILD),
  ];

  it("returns all pages when no pages are locked (workspace member)", async () => {
    const visible = await runWorkspace(
      Permissions.filterPagesByPermission(MEMBER, WS, "member", pages()),
      workspaceLayer,
    );
    expect(visible.map((p) => p.id).sort()).toEqual([GRANDCHILD, CHILD, PAGE].sort());
  });

  it("returns all pages for workspace owner regardless of locks", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'viewer', ?)")
      .run(PAGE, "user:someone-else");
    wsDb.close();

    const visible = await runWorkspace(
      Permissions.filterPagesByPermission(OWNER, WS, "owner", pages()),
      workspaceLayer,
    );
    expect(visible.length).toBe(3);
  });

  it("excludes a locked page the member has no access to", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)")
      .run(PAGE, "user:someone-else");
    wsDb.close();

    const visible = await runWorkspace(
      Permissions.filterPagesByPermission(MEMBER, WS, "member", pages()),
      workspaceLayer,
    );
    // PAGE is locked, CHILD and GRANDCHILD inherit lock → all excluded
    expect(visible.map((p) => p.id)).toEqual([]);
  });

  it("includes a locked page the member has explicit access to, plus its children", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)")
      .run(PAGE, `user:${MEMBER}`);
    wsDb.close();

    const visible = await runWorkspace(
      Permissions.filterPagesByPermission(MEMBER, WS, "member", pages()),
      workspaceLayer,
    );
    expect(visible.map((p) => p.id).sort()).toEqual([GRANDCHILD, CHILD, PAGE].sort());
  });

  it("listVisibleLockedPageIds returns the IDs of locked pages the caller can see", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, subject, relation) VALUES ('page', ?, ?, 'viewer')")
      .run(PAGE, `user:${MEMBER}`);
    wsDb.close();

    const ids = await runWorkspace(
      Permissions.listVisibleLockedPageIds(MEMBER, WS, "member"),
      workspaceLayer,
    );
    expect(ids).toEqual([PAGE]);
  });

  it("listVisibleLockedPageIds hides locked pages the caller is excluded from", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, subject, relation) VALUES ('page', ?, ?, 'viewer')")
      .run(PAGE, "user:someone-else");
    wsDb.close();

    const ids = await runWorkspace(
      Permissions.listVisibleLockedPageIds(MEMBER, WS, "member"),
      workspaceLayer,
    );
    expect(ids).toEqual([]);
  });

  it("listVisibleLockedPageIds returns all locked IDs to workspace owners", async () => {
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, subject, relation) VALUES ('page', ?, ?, 'viewer')")
      .run(PAGE, "user:someone-else");
    wsDb.close();

    const ids = await runWorkspace(
      Permissions.listVisibleLockedPageIds(OWNER, WS, "owner"),
      workspaceLayer,
    );
    expect(ids).toEqual([PAGE]);
  });

  it("listVisibleLockedPageIds returns an empty list when no pages are locked", async () => {
    const ids = await runWorkspace(
      Permissions.listVisibleLockedPageIds(MEMBER, WS, "member"),
      workspaceLayer,
    );
    expect(ids).toEqual([]);
  });

  it("excludes children of a locked page the member cannot access", async () => {
    const extraPage = "extra-root";
    const wsDb = new Database(path.join(tmpDir, "workspace.db"));
    // Lock PAGE (member excluded), but extraPage is open
    wsDb.prepare("INSERT INTO pages (id, parent_id) VALUES (?, ?)").run(extraPage, null);
    wsDb
      .prepare("INSERT INTO acl_tuples (resource_type, resource_id, relation, subject) VALUES ('page', ?, 'editor', ?)")
      .run(PAGE, "user:someone-else");
    wsDb.close();

    const allPages = [...pages(), makePage(extraPage, null)];
    const visible = await runWorkspace(
      Permissions.filterPagesByPermission(MEMBER, WS, "member", allPages),
      workspaceLayer,
    );
    // Only extraPage is visible — PAGE/CHILD/GRANDCHILD are locked to someone-else
    expect(visible.map((p) => p.id)).toEqual([extraPage]);
  });
});
