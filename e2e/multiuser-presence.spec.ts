/**
 * Presence: who the UI says is on the page, and whether that stays true.
 *
 * Heartbeats go out every 5s (presenceConnection.ts), the server keeps a 30s
 * presence TTL and a 10s focus/lock TTL (PresenceService.ts), and updates reach
 * peers over the SSE stream at /api/presence/stream.
 */
import {
	expect,
	heartbeatOnce,
	navigateToPageInApp,
	openPage,
	presenceAvatars,
	seedPage,
	test,
} from "./multiuser-helpers.js";

test("a peer opening the same page shows up as an avatar", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const { pageId } = await seedPage(alice, sharedWs, "Presence Page", [
		"First block",
	]);

	await openPage(alice, sharedWs, pageId);
	await expect(presenceAvatars(alice)).toHaveCount(0);

	await openPage(bob, sharedWs, pageId);

	await expect(presenceAvatars(alice)).toHaveCount(1, { timeout: 15_000 });
	await expect(presenceAvatars(alice).first()).toHaveAttribute(
		"title",
		bob.name,
	);
	// Presence is mutual: Bob must see Alice too.
	await expect(presenceAvatars(bob)).toHaveCount(1, { timeout: 15_000 });
	await expect(presenceAvatars(bob).first()).toHaveAttribute(
		"title",
		alice.name,
	);
});

test("a peer on a different page of the same workspace is not shown as present", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const here = await seedPage(alice, sharedWs, "Presence Page", [
		"First block",
	]);
	const elsewhere = await seedPage(alice, sharedWs, "Elsewhere", [
		"Away from the action",
	]);

	await openPage(alice, sharedWs, here.pageId);
	await openPage(bob, sharedWs, elsewhere.pageId);

	// Give heartbeats a couple of cycles to land before asserting the negative.
	await alice.page.waitForTimeout(12_000);
	await expect(presenceAvatars(alice)).toHaveCount(0);
});

test("a peer leaving the page stops being shown as present", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const here = await seedPage(alice, sharedWs, "Presence Page", [
		"First block",
	]);
	await seedPage(alice, sharedWs, "Elsewhere", ["Away from the action"]);

	await openPage(alice, sharedWs, here.pageId);
	await openPage(bob, sharedWs, here.pageId);
	await expect(presenceAvatars(alice)).toHaveCount(1, { timeout: 15_000 });

	// Bob picks another page in the sidebar — client-side routing, so the app
	// announces the departure while the page is still alive.
	await navigateToPageInApp(bob, "Elsewhere");

	await expect(presenceAvatars(alice)).toHaveCount(0, { timeout: 20_000 });
});

test("a peer closing their tab stops being shown as present", async ({
	alice,
	bob,
	sharedWs,
}) => {
	const { pageId } = await seedPage(alice, sharedWs, "Presence Page", [
		"First block",
	]);

	await openPage(alice, sharedWs, pageId);
	await openPage(bob, sharedWs, pageId);
	await expect(presenceAvatars(alice)).toHaveCount(1, { timeout: 15_000 });

	// The tab goes away without React cleanup; the pagehide handler reports it.
	// Tight timeout on purpose: the presence TTL is 30s, so this only passes if
	// the departure was actually announced rather than waited out.
	await bob.page.close();

	await expect(presenceAvatars(alice)).toHaveCount(0, { timeout: 15_000 });
});

test("a peer that goes silent expires by TTL without ever announcing a departure", async ({
	alice,
	bob,
	sharedWs,
}) => {
	test.setTimeout(180_000);
	const { pageId } = await seedPage(alice, sharedWs, "Presence Page", [
		"First block",
	]);

	await openPage(alice, sharedWs, pageId);

	// Bob is present via a bare HTTP heartbeat and then goes quiet — a killed
	// process, a dropped network, a sleeping laptop. Nothing will ever be sent on
	// his behalf, so only the TTL sweep can clear him. Driving this from the API
	// rather than a closed tab matters: a tab close does announce the departure,
	// and this assertion would then pass without the sweep working at all.
	await heartbeatOnce(bob, sharedWs, pageId);
	await expect(presenceAvatars(alice)).toHaveCount(1, { timeout: 15_000 });

	// Presence TTL is 30s, swept every 5s; allow slack for the drop to be seen.
	await expect(presenceAvatars(alice)).toHaveCount(0, { timeout: 90_000 });
});
