import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { ulid } from "ulidx";
import { WorkspaceDb } from "../db.js";

const STARTER_BLOCKS: ReadonlyArray<{ type: string; content: string }> = [
  { type: "heading1", content: "<h1>Welcome to Notara 👋</h1>" },
  {
    type: "paragraph",
    content:
      "<p>This workspace lives in a single SQLite file on the server you control. Your data is yours — exportable, portable, with no lock-in.</p>",
  },
  { type: "heading2", content: "<h2>The basics</h2>" },
  {
    type: "paragraph",
    content:
      "<p>Press <code>/</code> anywhere on a line to insert a block: heading, todo, quote, image, database, and more.</p>",
  },
  {
    type: "todo",
    content:
      '<ul class="task-list"><li data-checked="false">Check this item off (click the box)</li></ul>',
  },
  {
    type: "todo",
    content:
      '<ul class="task-list"><li data-checked="false">Create your first page from the sidebar</li></ul>',
  },
  {
    type: "todo",
    content:
      '<ul class="task-list"><li data-checked="false">Try a database — open a new page and type /database</li></ul>',
  },
  { type: "heading2", content: "<h2>Going further</h2>" },
  {
    type: "paragraph",
    content:
      "<p>Invite teammates from <strong>Workspace settings</strong>, or keep this workspace private. When you outgrow this getting-started page, delete it — it won't come back.</p>",
  },
];

/**
 * Seed a freshly created workspace with a "Getting Started" page so new users
 * land on something instead of an empty editor. Failures are swallowed by the
 * caller; an unseeded workspace is still a working workspace.
 */
export const seedStarterContent = (workspaceId: string) =>
  Effect.gen(function* () {
    const wdb = yield* WorkspaceDb;
    const layer = wdb.getLayer(workspaceId);

    const work = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const pageId = ulid();
      const now = new Date().toISOString();

      yield* sql`
        INSERT INTO pages (id, title, parent_id, sort_order, icon, created_at, updated_at)
        VALUES (${pageId}, ${"Getting Started"}, NULL, 1, ${"👋"}, ${now}, ${now})
      `;

      for (let i = 0; i < STARTER_BLOCKS.length; i++) {
        const b = STARTER_BLOCKS[i];
        yield* sql`
          INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
          VALUES (${ulid()}, ${pageId}, ${b.type}, ${b.content}, ${i}, NULL)
        `;
      }
    });

    yield* work.pipe(Effect.provide(layer));
  });
