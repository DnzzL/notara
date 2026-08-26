/**
 * Membership and access: who gets into a workspace, who gets shut out.
 *
 * Covers the invite-link join through the real /join/$token route, ACL-restricted
 * pages, member removal, and whether the workspace-membership RPCs are guarded
 * at all — the RPC router has no global auth gate, so each handler is the only
 * line of defence.
 */
import { request } from "@playwright/test";
import AdmZip from "adm-zip";
import {
	APP_ORIGIN,
	expect,
	openPage,
	rpcOnContext,
	seedPage,
	test,
} from "./multiuser-helpers.js";

/** An unauthenticated caller against the same RPC endpoint. */
async function anonymous<T>(
	method: string,
	payload: Record<string, unknown>,
): Promise<T> {
	const anon = await request.newContext({ baseURL: APP_ORIGIN });
	try {
		return await rpcOnContext<T>(anon, method, payload);
	} finally {
		await anon.dispose();
	}
}

test("a second user joins through the invite link and sees the workspace content", async ({
	alice,
	bob,
	soloWs,
}) => {
	await seedPage(alice, soloWs, "Shared Notes", ["Team content"]);

	await bob.page.goto(`/join/${soloWs.inviteToken}`);

	// Membership is granted by the route's beforeLoad…
	await expect
		.poll(
			async () =>
				(await bob.rpc<Array<{ slug: string }>>("getMyWorkspaces")).map(
					(w) => w.slug,
				),
			{ timeout: 20_000 },
		)
		.toContain(soloWs.slug);

	// …and the invitee should land inside the workspace, not be dropped on the
	// workspace picker with no indication of what just happened.
	await bob.page.waitForURL(`**/${soloWs.slug}**`, { timeout: 20_000 });
	await expect(bob.page.locator("[data-sidebar]")).toBeVisible({
		timeout: 20_000,
	});
	await expect(bob.page.locator("[data-sidebar]")).toContainText(
		"Shared Notes",
		{
			timeout: 20_000,
		},
	);
});

test("a non-member cannot read a page in the workspace", async ({
	alice,
	bob,
	soloWs,
}) => {
	const { pageId } = await seedPage(alice, soloWs, "Shared Notes", [
		"Team content",
	]);

	// Bob is authenticated but has not joined this workspace.
	await expect(
		bob.rpc("getPage", { id: pageId }, soloWs.workspaceId),
	).rejects.toThrow();
});

test("a member loses access once removed from the workspace", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const { pageId } = await seedPage(alice, sharedWs, "Shared Notes", [
		"Team content",
	]);
	await expect(
		bob.rpc("getPage", { id: pageId }, sharedWs.workspaceId),
	).resolves.toBeTruthy();

	await alice.rpc("removeMember", {
		workspaceId: sharedWs.workspaceId,
		userId: bob.userId,
	});

	await expect(
		bob.rpc("getPage", { id: pageId }, sharedWs.workspaceId),
	).rejects.toThrow();
});

test("a page restricted to the owner is invisible to a plain member", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const open = await seedPage(alice, sharedWs, "Shared Notes", [
		"Team content",
	]);
	const restricted = await seedPage(alice, sharedWs, "Owner Only", [
		"Private content",
	]);

	// Any ACL entry makes the page its own effective ACL owner, so members
	// without a matching grant resolve to denied.
	await alice.rpc(
		"writePagePermissions",
		{
			pageId: restricted.pageId,
			set: [{ subject: { type: "user", id: alice.userId }, relation: "owner" }],
			remove: [],
		},
		sharedWs.workspaceId,
	);

	await expect(
		bob.rpc("getPage", { id: restricted.pageId }, sharedWs.workspaceId),
	).rejects.toThrow();

	const visible = await bob.rpc<Array<{ id: string }>>(
		"listPages",
		{},
		sharedWs.workspaceId,
	);
	expect(visible.map((p) => p.id)).not.toContain(restricted.pageId);

	await openPage(bob, sharedWs, open.pageId);
	await expect(bob.page.locator("[data-sidebar]")).not.toContainText(
		"Owner Only",
	);
});

/** Smallest valid PNG: 1x1, transparent. */
const TINY_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);

/**
 * Upload an image onto a page and return its served URL.
 *
 * Failing loudly with the response body matters here: NOT-123 shipped because
 * every authenticated upload 500'd while the only coverage — the anonymous
 * guard — stayed green, so a bare truthiness check would have said nothing
 * useful about why.
 */
async function uploadPng(
	user: { api: import("@playwright/test").APIRequestContext },
	ws: { workspaceId: string },
	pageId: string,
	fileName: string,
): Promise<string> {
	const res = await user.api.post("/api/upload", {
		headers: {
			"X-Page-Id": pageId,
			"X-File-Name": fileName,
			"X-Workspace-Id": ws.workspaceId,
			"Content-Type": "image/png",
		},
		data: TINY_PNG,
	});
	if (!res.ok())
		throw new Error(`upload failed ${res.status()}: ${await res.text()}`);
	return ((await res.json()) as { fileUrl: string }).fileUrl;
}

test("an attachment is readable exactly as long as its page is", async ({
	alice,
	bob,
	sharedWs,
}) => {
	// ADR-006. Before it, the served file needed no session at all, so this URL
	// was a bearer token nobody could revoke.
	const restricted = await seedPage(alice, sharedWs, "Files To Lock", [
		"Team content",
	]);

	const fileUrl = await uploadPng(
		alice,
		sharedWs,
		restricted.pageId,
		"diagram.png",
	);

	// While the page is open to members, so is the file.
	expect((await bob.api.get(fileUrl)).status()).toBe(200);

	// Lock the page to alice alone.
	await alice.rpc(
		"writePagePermissions",
		{
			pageId: restricted.pageId,
			set: [{ subject: { type: "user", id: alice.userId }, relation: "owner" }],
			remove: [],
		},
		sharedWs.workspaceId,
	);

	// Bob loses the file with the page, immediately and without a re-upload.
	expect((await bob.api.get(fileUrl)).status()).toBe(403);

	// Alice, who can still read the page, still gets her file.
	expect((await alice.api.get(fileUrl)).status()).toBe(200);
});

test("an attachment in a workspace you are not in reads as missing", async ({
	alice,
	bob,
	soloWs,
}) => {
	// Bob is not a member of soloWs, so the file must not even be admitted to
	// exist — a 404, decided before the disk is touched.
	const page = await seedPage(alice, soloWs, "Solo Notes", ["Private content"]);

	const fileUrl = await uploadPng(alice, soloWs, page.pageId, "private.png");

	expect((await bob.api.get(fileUrl)).status()).toBe(404);
	expect((await alice.api.get(fileUrl)).status()).toBe(200);
});

test("an authenticated member can import a Notion export", async ({
	alice,
	soloWs,
}) => {
	// NOT-123 broke this route the same way it broke upload, and for the same
	// reason it went unnoticed: the only coverage was the anonymous guard, which
	// is answered before the handler reaches the service that was missing.
	const zip = new AdmZip();
	zip.addFile(
		"Imported Note.md",
		Buffer.from("# Imported Note\n\nHello from an export.\n"),
	);

	const res = await alice.api.post("/import-notion", {
		headers: {
			"X-Workspace-Id": soloWs.workspaceId,
			"Content-Type": "application/zip",
			"Content-Disposition": 'attachment; filename="export.zip"',
		},
		data: zip.toBuffer(),
	});
	if (!res.ok())
		throw new Error(`import failed ${res.status()}: ${await res.text()}`);

	const pages = await alice.rpc<Array<{ title: string }>>(
		"listPages",
		{},
		soloWs.workspaceId,
	);
	expect(pages.map((p) => p.title)).toContain("Imported Note");
});

test("workspace membership cannot be read by an unauthenticated caller", async ({
	alice,
	soloWs,
}) => {
	// getWorkspaceMembers returns member names and email addresses.
	const members = await anonymous<Array<{ email: string }>>(
		"getWorkspaceMembers",
		{
			workspaceId: soloWs.workspaceId,
		},
	).catch(() => null);

	expect(
		members,
		`anonymous caller received the member list: ${JSON.stringify(members)}`,
	).toBeNull();
});

test("a member cannot rotate the workspace invite token", async ({
	alice,
	bob,
	sharedWs,
}) => {
	// Rotating the invite link is an owner action exposed in workspace settings.
	await expect(
		bob.rpc(
			"regenerateInviteLink",
			{ workspaceId: sharedWs.workspaceId },
			sharedWs.workspaceId,
		),
	).rejects.toThrow();
});

test("a member cannot mail out the workspace invite token", async ({
	alice,
	bob,
	sharedWs,
}) => {
	// Same capability as rotating the link: the mail body carries the invite
	// token, so this is an owner action too.
	await expect(
		bob.rpc(
			"inviteMemberByEmail",
			{ workspaceId: sharedWs.workspaceId, email: bob.email },
			sharedWs.workspaceId,
		),
	).rejects.toThrow();
});

test("a non-member cannot mail themselves an invite to someone else's workspace", async ({
	alice,
	bob,
	soloWs,
}) => {
	// NOT-102: this RPC used to check only that a session existed, so any signed-in
	// user who knew a workspace id could have the invite token mailed to them and
	// walk in. The guard has to reject before the handler runs, since the handler
	// itself is what sends the mail.
	await expect(
		bob.rpc(
			"inviteMemberByEmail",
			{ workspaceId: soloWs.workspaceId, email: bob.email },
			soloWs.workspaceId,
		),
	).rejects.toThrow();

	// And it stays shut: bob must still be outside the workspace afterwards.
	const slugs = (await bob.rpc<Array<{ slug: string }>>("getMyWorkspaces")).map(
		(w) => w.slug,
	);
	expect(slugs).not.toContain(soloWs.slug);
});

test("an unauthenticated caller cannot evict a workspace member", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const { pageId } = await seedPage(alice, sharedWs, "Shared Notes", [
		"Team content",
	]);

	await anonymous("removeMember", {
		workspaceId: sharedWs.workspaceId,
		userId: bob.userId,
	}).catch(() => null);

	// Bob must still be a member.
	await expect(
		bob.rpc("getPage", { id: pageId }, sharedWs.workspaceId),
	).resolves.toBeTruthy();
});
