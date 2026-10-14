/**
 * The inbox (NOT-152): a member works a queue of what concerns them — comments
 * that mention them, and comments on records they are assigned to — instead of
 * searching boards for it.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import * as Comments from "../src/handlers/comments.js";
import * as Databases from "../src/handlers/databases.js";
import * as Inbox from "../src/handlers/inbox.js";
import * as Pages from "../src/handlers/pages.js";
import { subscribeInbox } from "../src/inbox-stream.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

type Api = ReturnType<typeof restWorkspace>;

const say = (api: Api, pageId: string, authorId: string, body: string) =>
	api.run(
		Comments.addComment({ pageId, workspaceId: WORKSPACE, authorId, body }),
	);

const page = (api: Api) =>
	api.run(Pages.createPage({ title: "Plan", parentId: null }));

/** A record assigned to `assignees` through a people field, opened as a page. */
const assignedRecord = (api: Api, assignees: string[]) =>
	api.run(
		Effect.gen(function* () {
			const host = yield* Pages.createPage({ title: "Board", parentId: null });
			const db = yield* Databases.createDatabase({
				pageId: host.id,
				name: "Notara",
			});
			const owner = yield* Databases.createField({
				databaseId: db.id,
				name: "Owner",
				type: "people",
				options: null,
				relationTargetDbId: null,
			});
			const rec = yield* Databases.createRecord({
				databaseId: db.id,
				title: "Card",
			});
			yield* Databases.updateFieldValue({
				recordId: rec.id,
				fieldId: owner.id,
				value: JSON.stringify(assignees),
			});
			return yield* Databases.openRecordAsPage(rec.id);
		}),
	);

const inbox = (api: Api, userId: string) => api.run(Inbox.listInbox(userId));

describe("the inbox", () => {
	test("a mention lands in the mentioned member's inbox, not the author's", async () => {
		using api = restWorkspace();
		const p = await page(api);
		await say(api, p.id, "ann", "@bob and @ann, look");
		const [entry, ...rest] = await inbox(api, "bob");
		expect(rest).toEqual([]);
		expect(entry).toMatchObject({
			pageId: p.id,
			pageTitle: "Plan",
			authorId: "ann",
			reason: "mention",
			keyName: null,
			readAt: null,
		});
		expect(entry.excerpt).toContain("@bob and @ann");
		expect(await inbox(api, "ann")).toEqual([]);
	});

	test("a comment on a record lands with the members it is assigned to", async () => {
		using api = restWorkspace();
		const { pageId } = await assignedRecord(api, ["ann", "bob"]);
		await say(api, pageId, "ann", "done, please check");
		expect((await inbox(api, "bob")).map((e) => e.reason)).toEqual([
			"assigned",
		]);
		expect(await inbox(api, "ann")).toEqual([]);
	});

	test("mentioned and assigned is one entry", async () => {
		using api = restWorkspace();
		const { pageId } = await assignedRecord(api, ["bob"]);
		await say(api, pageId, "ann", "@bob");
		expect((await inbox(api, "bob")).map((e) => e.reason)).toEqual(["mention"]);
	});

	test("nothing lands for a member who cannot see the page", async () => {
		using api = restWorkspace();
		const p = await page(api);
		await api.run(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`INSERT INTO acl_tuples (resource_type, resource_id, relation, subject)
          VALUES ('page', ${p.id}, 'owner', 'user:ann')`;
			}),
		);
		await say(api, p.id, "ann", "@bob secret");
		expect(await inbox(api, "bob")).toEqual([]);
	});

	test("an edit that adds a mention adds an entry, once", async () => {
		using api = restWorkspace();
		const p = await page(api);
		const c = await say(api, p.id, "ann", "draft");
		const edit = (body: string) =>
			api.run(
				Comments.updateComment({
					id: c.id,
					workspaceId: WORKSPACE,
					authorId: "ann",
					body,
				}),
			);
		await edit("@bob draft");
		await edit("@bob final");
		expect(await inbox(api, "bob")).toHaveLength(1);
	});

	test("entries are read one by one or all at once", async () => {
		using api = restWorkspace();
		const p = await page(api);
		await say(api, p.id, "ann", "@bob one");
		await say(api, p.id, "ann", "@bob two");
		const [newest] = await inbox(api, "bob");
		await api.run(
			Inbox.markRead({
				workspaceId: WORKSPACE,
				userId: "bob",
				ids: [newest.id],
			}),
		);
		expect(await api.run(Inbox.unreadCount("bob"))).toBe(1);
		await api.run(Inbox.markRead({ workspaceId: WORKSPACE, userId: "bob" }));
		expect(await api.run(Inbox.unreadCount("bob"))).toBe(0);
		expect((await inbox(api, "bob")).every((e) => e.readAt !== null)).toBe(
			true,
		);
	});

	test("purging a page removes its entries", async () => {
		using api = restWorkspace();
		const p = await page(api);
		await say(api, p.id, "ann", "@bob");
		await api.run(Databases.purgePage(p.id));
		expect(await inbox(api, "bob")).toEqual([]);
	});

	test("an open inbox stream hears the new unread count", async () => {
		using api = restWorkspace();
		const p = await page(api);
		const heard: unknown[] = [];
		const unsubscribe = subscribeInbox(WORKSPACE, "bob", (e) => heard.push(e));
		await say(api, p.id, "ann", "@bob");
		unsubscribe();
		expect(heard).toEqual([{ type: "inbox.unread", count: 1 }]);
	});

	test("a comment written through a key reaches the key's owner", async () => {
		using api = restWorkspace();
		const { pageId } = await assignedRecord(api, ["ann"]);
		const res = await api.call(
			"POST",
			`/api/v1/workspaces/${WORKSPACE}/pages/${pageId}/comments`,
			{ key: "write", body: { body: "Blocked: which locale?" } },
		);
		expect(res.status).toBe(201);
		expect((await inbox(api, "ann")).map((e) => e.reason)).toEqual([
			"assigned",
		]);
	});

	test("a key's comment reaches its owner on a page nothing assigns them", async () => {
		using api = restWorkspace();
		const p = await page(api);
		const res = await api.call(
			"POST",
			`/api/v1/workspaces/${WORKSPACE}/pages/${p.id}/comments`,
			{ key: "write", body: { body: "Done; tests pass." } },
		);
		expect(res.status).toBe(201);
		expect(await inbox(api, "ann")).toMatchObject([
			{ reason: "agent", keyName: "docket" },
		]);
	});

	test("a key's comment mentioning its owner lands once, as a mention", async () => {
		using api = restWorkspace();
		const p = await page(api);
		await api.call(
			"POST",
			`/api/v1/workspaces/${WORKSPACE}/pages/${p.id}/comments`,
			{ key: "write", body: { body: "@ann which locale?" } },
		);
		expect((await inbox(api, "ann")).map((e) => e.reason)).toEqual(["mention"]);
	});

	test("deleting a comment updates the open inboxes it was in", async () => {
		using api = restWorkspace();
		const p = await page(api);
		const c = await say(api, p.id, "ann", "@bob");
		const heard: unknown[] = [];
		const unsubscribe = subscribeInbox(WORKSPACE, "bob", (e) => heard.push(e));
		await api.run(
			Comments.deleteComment({
				id: c.id,
				workspaceId: WORKSPACE,
				authorId: "ann",
			}),
		);
		unsubscribe();
		expect(heard).toEqual([{ type: "inbox.unread", count: 0 }]);
		expect(await inbox(api, "bob")).toEqual([]);
	});
});
