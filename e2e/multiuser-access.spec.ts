/**
 * Membership and access: who gets into a workspace, who gets shut out.
 *
 * Covers the invite-link join through the real /join/$token route, ACL-restricted
 * pages, member removal, and whether the workspace-membership RPCs are guarded
 * at all — the RPC router has no global auth gate, so each handler is the only
 * line of defence.
 */
import { request } from "@playwright/test";
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
