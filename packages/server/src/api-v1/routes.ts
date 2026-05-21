import { Effect } from "effect";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { WorkspaceDb } from "../db.js";
import * as Pages from "../handlers/pages.js";
import * as Blocks from "../handlers/blocks.js";
import * as Search from "../handlers/search.js";
import * as Databases from "../handlers/databases.js";
import * as Workspaces from "../handlers/workspaces.js";
import { resolveApiUser, requireWorkspaceMember, ApiError } from "./auth.js";
import {
  ok, created, noContent, apiError, parseBody,
  requireField, optionalField, queryParam, handle, requireParam,
} from "./response.js";
import { spec as openApiSpec, swaggerHtml } from "./openapi.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run a workspace-scoped handler with the correct per-workspace SQLite layer. */
const withWorkspace = <A>(
  workspaceId: string,
  inner: Effect.Effect<A, unknown, import("@effect/sql").SqlClient.SqlClient>,
) =>
  Effect.gen(function* () {
    const wdb = yield* WorkspaceDb;
    return yield* Effect.provide(inner, wdb.getLayer(workspaceId));
  });

/** Parse block content from its stored JSON string to an object for REST consumers. */
const parseBlockContent = (block: { content: string; [k: string]: unknown }) => ({
  ...block,
  content: (() => {
    try { return JSON.parse(block.content); } catch { return block.content; }
  })(),
});

/** Stringify content back to JSON for storage when it arrives as a JS object. */
const stringifyContent = (raw: unknown): string =>
  typeof raw === "string" ? raw : JSON.stringify(raw);

// ── Route registration ────────────────────────────────────────────────────────

export const registerV1Routes = Effect.gen(function* () {
  const router = yield* HttpLayerRouter.HttpRouter;

  // ── OpenAPI spec + Swagger UI ─────────────────────────────────────────────

  yield* router.add(
    "GET",
    "/api/v1/openapi.json",
    Effect.succeed(
      HttpServerResponse.text(JSON.stringify(openApiSpec, null, 2), {
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  yield* router.add(
    "GET",
    "/api/docs",
    Effect.succeed(
      HttpServerResponse.text(swaggerHtml, {
        headers: { "Content-Type": "text/html" },
      }),
    ),
  );

  // ── GET /api/v1/workspaces ────────────────────────────────────────────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const workspaces = yield* Workspaces.getMyWorkspaces(userId);
      return ok(workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug, role: w.role })));
    })),
  );

  // ── GET /api/v1/workspaces/:workspaceId/pages ─────────────────────────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces/:workspaceId/pages",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const pages = yield* withWorkspace(workspaceId, Pages.listPages);
      return ok(pages);
    })),
  );

  // ── POST /api/v1/workspaces/:workspaceId/pages ────────────────────────────

  yield* router.add(
    "POST",
    "/api/v1/workspaces/:workspaceId/pages",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const body = yield* parseBody;
      const title = yield* requireField(body, "title");
      const parentId = optionalField(body, "parentId");
      const page = yield* withWorkspace(workspaceId, Pages.createPage({ title, parentId }));
      return created(page);
    })),
  );

  // ── GET /api/v1/workspaces/:workspaceId/pages/:pageId ────────────────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces/:workspaceId/pages/:pageId",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const pageId = yield* requireParam(p, "pageId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const page = yield* withWorkspace(workspaceId, Pages.getPage(pageId)).pipe(
        Effect.mapError(() => new ApiError({ status: 404, message: `Page ${pageId} not found` })),
      );
      return ok(page);
    })),
  );

  // ── PATCH /api/v1/workspaces/:workspaceId/pages/:pageId ──────────────────

  yield* router.add(
    "PATCH",
    "/api/v1/workspaces/:workspaceId/pages/:pageId",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const pageId = yield* requireParam(p, "pageId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const body = yield* parseBody;
      const b = body as Record<string, unknown>;
      const page = yield* withWorkspace(
        workspaceId,
        Pages.updatePage({
          id: pageId,
          title:      typeof b.title      === "string" ? b.title : undefined,
          icon:       "icon"      in b ? (b.icon      as string | null) : undefined,
          coverUrl:   "coverUrl"  in b ? (b.coverUrl  as string | null) : undefined,
          isFavorite: "isFavorite" in b ? Boolean(b.isFavorite) : undefined,
        }),
      ).pipe(
        Effect.mapError(() => new ApiError({ status: 404, message: `Page ${pageId} not found` })),
      );
      return ok(page);
    })),
  );

  // ── DELETE /api/v1/workspaces/:workspaceId/pages/:pageId ─────────────────

  yield* router.add(
    "DELETE",
    "/api/v1/workspaces/:workspaceId/pages/:pageId",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const pageId = yield* requireParam(p, "pageId");
      yield* requireWorkspaceMember(workspaceId, userId);
      yield* withWorkspace(workspaceId, Pages.deletePage(pageId));
      return noContent();
    })),
  );

  // ── GET /api/v1/workspaces/:workspaceId/pages/:pageId/blocks ─────────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const pageId = yield* requireParam(p, "pageId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const blocks = yield* withWorkspace(workspaceId, Blocks.listBlocks(pageId));
      return ok(blocks.map(parseBlockContent));
    })),
  );

  // ── POST /api/v1/workspaces/:workspaceId/pages/:pageId/blocks ────────────

  yield* router.add(
    "POST",
    "/api/v1/workspaces/:workspaceId/pages/:pageId/blocks",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const pageId = yield* requireParam(p, "pageId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const body = yield* parseBody;
      const b = body as Record<string, unknown>;
      const type = yield* requireField(body, "type");
      const content = stringifyContent(b.content ?? {});
      const index = typeof b.index === "number" ? b.index : 0;
      const parentId = optionalField(body, "parentId");
      const block = yield* withWorkspace(
        workspaceId,
        Blocks.createBlock({ pageId, type, content, index, parentId }),
      );
      return created(parseBlockContent(block));
    })),
  );

  // ── PATCH /api/v1/workspaces/:workspaceId/blocks/:blockId ────────────────

  yield* router.add(
    "PATCH",
    "/api/v1/workspaces/:workspaceId/blocks/:blockId",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const blockId = yield* requireParam(p, "blockId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const body = yield* parseBody;
      const b = body as Record<string, unknown>;
      if (!("content" in b)) {
        return yield* Effect.fail(new ApiError({ status: 422, message: 'Field "content" is required' }));
      }
      const block = yield* withWorkspace(
        workspaceId,
        Blocks.updateBlock({ id: blockId, content: stringifyContent(b.content) }),
      ).pipe(
        Effect.mapError(() => new ApiError({ status: 404, message: `Block ${blockId} not found` })),
      );
      return ok(parseBlockContent(block));
    })),
  );

  // ── DELETE /api/v1/workspaces/:workspaceId/blocks/:blockId ───────────────

  yield* router.add(
    "DELETE",
    "/api/v1/workspaces/:workspaceId/blocks/:blockId",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const blockId = yield* requireParam(p, "blockId");
      yield* requireWorkspaceMember(workspaceId, userId);
      yield* withWorkspace(workspaceId, Blocks.deleteBlock(blockId));
      return noContent();
    })),
  );

  // ── GET /api/v1/workspaces/:workspaceId/databases ────────────────────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces/:workspaceId/databases",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const dbs = yield* withWorkspace(workspaceId, Databases.listAllDatabases);
      return ok(dbs);
    })),
  );

  // ── GET /api/v1/workspaces/:workspaceId/databases/:dbId/records ──────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces/:workspaceId/databases/:dbId/records",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      const dbId = yield* requireParam(p, "dbId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const raw = yield* withWorkspace(workspaceId, Databases.listRecordsWithValues(dbId));
      const records = (raw as any[]).map((r) => ({
        id:          r.id,
        databaseId:  r.databaseId,
        title:       r.title,
        description: r.description ?? null,
        isDeleted:   r.isDeleted,
        createdAt:   r.createdAt,
        fields:      Object.fromEntries(
          ((r.values ?? []) as any[]).map((v: any) => [v.fieldName ?? v.fieldId, v.value]),
        ),
      }));
      return ok(records);
    })),
  );

  // ── GET /api/v1/workspaces/:workspaceId/search ───────────────────────────

  yield* router.add(
    "GET",
    "/api/v1/workspaces/:workspaceId/search",
    handle(Effect.gen(function* () {
      const { userId } = yield* resolveApiUser;
      const p = yield* HttpRouter.params;
      const workspaceId = yield* requireParam(p, "workspaceId");
      yield* requireWorkspaceMember(workspaceId, userId);
      const q = yield* queryParam("q");
      if (!q?.trim()) {
        return yield* Effect.fail(new ApiError({ status: 422, message: 'Query parameter "q" is required' }));
      }
      const results = yield* withWorkspace(workspaceId, Search.globalSearch(q));
      return ok(results);
    })),
  );
});
