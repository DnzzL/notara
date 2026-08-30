/**
 * A page published to the open web, and the two ways that link must die.
 *
 * This is the first unauthenticated read path in the app, so what is asserted
 * here is mostly what a stranger CANNOT get: a revoked token, a page that
 * reaches outside itself, and — the one that would be easiest to get wrong — a
 * link that outlives its publisher's own access to the page.
 *
 * Requests to the public route carry no cookie. A browser context would prove
 * nothing: the page would be readable because the reader is a member.
 */
import { request } from "@playwright/test";
import {
	APP_ORIGIN,
	expect,
	openPage,
	seedPage,
	test,
} from "./multiuser-helpers.js";

/** A request context with no session at all — a stranger with a URL. */
const anonymous = () => request.newContext({ baseURL: APP_ORIGIN });

const publicUrl = (token: string) => `/api/public/pages/${token}`;

test("a shared page is readable by a stranger, and stops being once revoked", async ({
	alice,
	soloWs,
}) => {
	const { pageId } = await seedPage(alice, soloWs, "Published", ["Hello web"]);

	const token = await alice.rpc<string>(
		"setPageSharing",
		{ pageId, enabled: true },
		soloWs.workspaceId,
	);
	expect(token).toBeTruthy();

	const anon = await anonymous();
	const res = await anon.get(publicUrl(token));
	expect(res.status(), await res.text()).toBe(200);

	const body = (await res.json()) as {
		page: { id: string; title: string };
		blocks: Array<{ content: string }>;
	};

	// Exactly three keys: anything else added here is added for the whole internet.
	expect(Object.keys(body).sort()).toEqual(["blocks", "databases", "page"]);
	expect(body.page.id).toBe(pageId);
	expect(body.page.title).toBe("Published");
	// parentId names a page this token does not cover, so it must not travel.
	expect(body.page).not.toHaveProperty("parentId");
	expect(body.blocks.some((b) => b.content.includes("Hello web"))).toBe(true);

	// A link handed out and taken back must not come alive again.
	await alice.rpc(
		"setPageSharing",
		{ pageId, enabled: false },
		soloWs.workspaceId,
	);
	expect((await anon.get(publicUrl(token))).status()).toBe(404);

	await anon.dispose();
});

test("re-enabling is idempotent while live, and mints a new token after revoking", async ({
	alice,
	soloWs,
}) => {
	// Two live links to one page would make revoking ambiguous — disabling would
	// silently leave the other one working.
	const { pageId } = await seedPage(alice, soloWs, "Toggled", ["Body"]);
	const share = (enabled: boolean) =>
		alice.rpc<string | null>(
			"setPageSharing",
			{ pageId, enabled },
			soloWs.workspaceId,
		);

	const first = await share(true);
	expect(await share(true)).toBe(first);
	expect(
		await alice.rpc<string | null>(
			"getPageShare",
			{ pageId },
			soloWs.workspaceId,
		),
	).toBe(first);

	await share(false);
	const second = await share(true);
	expect(second).not.toBe(first);

	const anon = await anonymous();
	expect((await anon.get(publicUrl(first as string))).status()).toBe(404);
	expect((await anon.get(publicUrl(second as string))).status()).toBe(200);
	await anon.dispose();
});

test("locking the page cuts the link its publisher handed out", async ({
	alice,
	bob,
	sharedWs,
}) => {
	// The decision this protects: a capability delegated by a person does not
	// outlive that person's own access. Without it, bob publishes a page, alice
	// locks it to herself, and bob's link keeps serving it to the internet —
	// with nobody able to see that the link exists.
	const { pageId } = await seedPage(alice, sharedWs, "Team page", ["Secret"]);

	const token = await bob.rpc<string>(
		"setPageSharing",
		{ pageId, enabled: true },
		sharedWs.workspaceId,
	);
	const anon = await anonymous();
	expect((await anon.get(publicUrl(token))).status()).toBe(200);

	// Any ACL entry makes the page its own effective ACL owner, so bob resolves
	// to denied — see docs/adr/007.
	await alice.rpc(
		"writePagePermissions",
		{
			pageId,
			set: [{ subject: { type: "user", id: alice.userId }, relation: "owner" }],
			remove: [],
		},
		sharedWs.workspaceId,
	);

	expect((await anon.get(publicUrl(token))).status()).toBe(404);
	await anon.dispose();
});

test("blocks that reach outside the shared page are served blank", async ({
	alice,
	soloWs,
}) => {
	// Following them would need a second access decision per block, which is the
	// kind of decision someone eventually forgets to write (NOT-102). Redaction
	// happens on the server: a client-side omission is a leak with a View Source.
	const secret = await seedPage(alice, soloWs, "Not shared", ["Confidential"]);
	const { pageId } = await seedPage(alice, soloWs, "Has a link", ["Intro"]);

	await alice.rpc(
		"createBlock",
		{
			pageId,
			type: "pageLink",
			content: JSON.stringify({ pageId: secret.pageId }),
			index: 1,
			parentId: null,
		},
		soloWs.workspaceId,
	);

	const token = await alice.rpc<string>(
		"setPageSharing",
		{ pageId, enabled: true },
		soloWs.workspaceId,
	);
	const anon = await anonymous();
	const body = (await (await anon.get(publicUrl(token))).json()) as {
		blocks: Array<{ type: string; content: string }>;
	};

	const link = body.blocks.find((b) => b.type === "pageLink");
	// Kept, so the page still reads as written — but carrying nothing.
	expect(link).toBeTruthy();
	expect(link?.content).toBe("");
	expect(JSON.stringify(body)).not.toContain(secret.pageId);

	await anon.dispose();
});

test("a database block on a shared page renders as a table, with relation/page/people cells blanked", async ({
	alice,
	soloWs,
}) => {
	// The one exception to "reaches outside the page, so it's blanked": a
	// database has no ACL of its own, so it gets the same publisher recheck as
	// the page — see public-page.ts. Cells that still name something outside
	// the database (people, here) stay blanked regardless.
	const { pageId } = await seedPage(alice, soloWs, "Has a table", ["Intro"]);

	const db = await alice.rpc<{ id: string }>(
		"createDatabase",
		{ pageId, name: "Tasks" },
		soloWs.workspaceId,
	);
	const textField = await alice.rpc<{ id: string }>(
		"createField",
		{
			databaseId: db.id,
			name: "Note",
			type: "text",
			options: null,
			relationTargetDbId: null,
		},
		soloWs.workspaceId,
	);
	const peopleField = await alice.rpc<{ id: string }>(
		"createField",
		{
			databaseId: db.id,
			name: "Owner",
			type: "people",
			options: null,
			relationTargetDbId: null,
		},
		soloWs.workspaceId,
	);
	const record = await alice.rpc<{ id: string }>(
		"createRecord",
		{ databaseId: db.id, title: "First row" },
		soloWs.workspaceId,
	);
	await alice.rpc(
		"updateFieldValue",
		{ recordId: record.id, fieldId: textField.id, value: "Hello table" },
		soloWs.workspaceId,
	);
	await alice.rpc(
		"updateFieldValue",
		{
			recordId: record.id,
			fieldId: peopleField.id,
			value: JSON.stringify([alice.userId]),
		},
		soloWs.workspaceId,
	);
	await alice.rpc(
		"createBlock",
		{ pageId, type: "database", content: db.id, index: 1, parentId: null },
		soloWs.workspaceId,
	);

	const token = await alice.rpc<string>(
		"setPageSharing",
		{ pageId, enabled: true },
		soloWs.workspaceId,
	);

	const anon = await anonymous();
	const body = (await (await anon.get(publicUrl(token))).json()) as {
		blocks: Array<{ type: string; content: string }>;
		databases: Record<
			string,
			{ records: Array<{ values: Record<string, unknown> }> }
		>;
	};

	const dbBlock = body.blocks.find((b) => b.type === "database");
	// The block keeps its content (the database id) instead of being blanked,
	// since the publisher can still read the page this database lives on.
	expect(dbBlock?.content).toBe(db.id);

	const publicDb = body.databases[db.id];
	expect(publicDb?.records[0]?.values.Note).toBe("Hello table");
	// A people cell names a workspace member — blanked even though the
	// database itself is shown.
	expect(publicDb?.records[0]?.values.Owner).toBeNull();
	expect(JSON.stringify(body)).not.toContain(alice.userId);

	await anon.dispose();
});

test("sharing needs editor rights, and the link is kept out of search results", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const { pageId } = await seedPage(alice, sharedWs, "Locked down", ["Body"]);
	await alice.rpc(
		"writePagePermissions",
		{
			pageId,
			set: [
				{ subject: { type: "user", id: alice.userId }, relation: "owner" },
				{ subject: { type: "user", id: bob.userId }, relation: "viewer" },
			],
			remove: [],
		},
		sharedWs.workspaceId,
	);

	// A viewer may read the page but may not publish it to the internet.
	await expect(
		bob.rpc("setPageSharing", { pageId, enabled: true }, sharedWs.workspaceId),
	).rejects.toThrow();

	const token = await alice.rpc<string>(
		"setPageSharing",
		{ pageId, enabled: true },
		sharedWs.workspaceId,
	);
	const anon = await anonymous();
	const res = await anon.get(publicUrl(token));
	// A link someone chose to hand out is not a page they chose to publish.
	expect(res.headers()["x-robots-tag"]).toContain("noindex");
	await anon.dispose();
});

/** Smallest valid PNG: 1x1, transparent. */
const TINY_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);

/** Upload an image onto a page and return the file name it was served under. */
async function uploadPng(
	user: { api: import("@playwright/test").APIRequestContext },
	workspaceId: string,
	pageId: string,
	fileName: string,
): Promise<string> {
	const res = await user.api.post("/api/upload", {
		headers: {
			"X-Page-Id": pageId,
			"X-File-Name": fileName,
			"X-Workspace-Id": workspaceId,
			"Content-Type": "image/png",
		},
		data: TINY_PNG,
	});
	if (!res.ok())
		throw new Error(`upload failed ${res.status()}: ${await res.text()}`);
	const { fileUrl } = (await res.json()) as { fileUrl: string };
	return fileUrl.split("/").pop() as string;
}

test("an image on a shared page is served by the token, and only that page's images are", async ({
	alice,
	soloWs,
}) => {
	// A public page whose images 404 is a broken feature, so the token has to
	// reach them. ADR-006 says an attachment is readable exactly when its page
	// is; the token does not change that rule, it changes who the reader is —
	// and it grants ONE page, which is what the second half of this asserts.
	const shared = await seedPage(alice, soloWs, "With picture", ["Intro"]);
	const other = await seedPage(alice, soloWs, "Private album", ["Intro"]);

	const onShared = await uploadPng(
		alice,
		soloWs.workspaceId,
		shared.pageId,
		"public.png",
	);
	const onOther = await uploadPng(
		alice,
		soloWs.workspaceId,
		other.pageId,
		"private.png",
	);

	const token = await alice.rpc<string>(
		"setPageSharing",
		{ pageId: shared.pageId, enabled: true },
		soloWs.workspaceId,
	);

	const anon = await anonymous();
	const attach = (file: string) =>
		anon.get(`/api/public/pages/${token}/attachments/${file}`);

	expect((await attach(onShared)).status()).toBe(200);
	// The token is not a key to the workspace's uploads.
	expect((await attach(onOther)).status()).toBe(404);
	// And the authenticated route still refuses a stranger outright.
	expect((await anon.get(`/attachments/${onShared}`)).status()).toBe(401);

	await alice.rpc(
		"setPageSharing",
		{ pageId: shared.pageId, enabled: false },
		soloWs.workspaceId,
	);
	expect((await attach(onShared)).status()).toBe(404);

	await anon.dispose();
});

test("a stranger opening the link sees the page, not a login form", async ({
	alice,
	soloWs,
	browser,
}) => {
	// Every other route in the app gates on a session. This one must not — the
	// whole point is that the reader has none, so the assertion is made in a
	// context that has never signed in.
	const { pageId } = await seedPage(alice, soloWs, "Open to all", [
		"Readable by anyone",
	]);
	const token = await alice.rpc<string>(
		"setPageSharing",
		{ pageId, enabled: true },
		soloWs.workspaceId,
	);

	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${APP_ORIGIN}/p/${token}`);

	await expect(
		page.getByRole("heading", { name: "Open to all" }),
	).toBeVisible();
	await expect(page.getByText("Readable by anyone")).toBeVisible();
	await expect(page.getByText("Made with Notara")).toBeVisible();
	expect(page.url()).not.toContain("/login");

	// And once revoked, the reader is told the link does not work — never why.
	await alice.rpc(
		"setPageSharing",
		{ pageId, enabled: false },
		soloWs.workspaceId,
	);
	await page.goto(`${APP_ORIGIN}/p/${token}`);
	await expect(page.getByText("This page isn't available")).toBeVisible();

	await context.close();
});

test("the share modal publishes the page and hands back a working URL", async ({
	alice,
	soloWs,
}) => {
	// The toggle lives in the share modal rather than beside it in the page
	// menu: "who can see this" is one question, and answering it in two places
	// invites a page locked to three people AND published to everyone.
	const { pageId } = await seedPage(alice, soloWs, "Toggle me", ["Body text"]);
	await openPage(alice, soloWs, pageId);

	// The sidebar rows carry a "More actions" button each; the page header's is
	// the last in the document.
	await alice.page.getByTitle("More actions").last().click();
	await alice.page.getByRole("button", { name: "Share…" }).click();

	const toggle = alice.page.locator('input[name="share-to-web"]');
	await expect(toggle).not.toBeChecked();
	// click(), not check(): the box is controlled by the server's answer, so it
	// only flips once setPageSharing returns. check() asserts on the state
	// synchronously and would race the round-trip.
	await toggle.click();
	await expect(toggle).toBeChecked();

	const url = alice.page.locator("code", { hasText: "/p/" });
	await expect(url).toBeVisible();
	const publicUrlText = (await url.textContent()) ?? "";
	expect(publicUrlText).toContain(`${APP_ORIGIN}/p/`);

	// The URL the UI shows is the one that actually serves the page.
	const anon = await anonymous();
	const token = publicUrlText.split("/p/")[1] as string;
	expect((await anon.get(publicUrl(token))).status()).toBe(200);

	// Turning it off breaks the link for good.
	await toggle.click();
	await expect(toggle).not.toBeChecked();
	await expect(url).toBeHidden();
	expect((await anon.get(publicUrl(token))).status()).toBe(404);

	await anon.dispose();
});
