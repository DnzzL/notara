import { beforeEach, describe, expect, it } from "bun:test";
import {
	createPresenceService,
	type PresenceEvent,
} from "./PresenceService.js";

// Use a controllable clock so we can assert TTL behavior without sleeps.
function makeClock(start = 1_000_000) {
	let t = start;
	return {
		now: () => t,
		advance: (ms: number) => {
			t += ms;
		},
	};
}

const WS = "ws-1";
const PAGE = "page-1";
const ALICE = { id: "u-alice", name: "Alice" };
const BOB = { id: "u-bob", name: "Bob" };
const BLOCK_A = "block-a";
const BLOCK_B = "block-b";

describe("PresenceService", () => {
	let clock: ReturnType<typeof makeClock>;

	beforeEach(() => {
		clock = makeClock();
	});

	// ── Tracer bullet ─────────────────────────────────────────────────────────
	it("records a heartbeat and reports the user as present on the page", () => {
		const svc = createPresenceService({ now: clock.now });
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: null,
		});

		const present = svc.presence(WS, PAGE);
		expect(present).toEqual([
			{ userId: ALICE.id, name: ALICE.name, focusedBlockId: null },
		]);
	});

	it("dedupes presence by userId across multiple heartbeats", () => {
		const svc = createPresenceService({ now: clock.now });
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: null,
		});
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: BLOCK_A,
		});
		expect(svc.presence(WS, PAGE).length).toBe(1);
		expect(svc.presence(WS, PAGE)[0].focusedBlockId).toBe(BLOCK_A);
	});

	it("reports the lockHolder of a focused block", () => {
		const svc = createPresenceService({ now: clock.now });
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: BLOCK_A,
		});
		expect(svc.lockHolder(WS, PAGE, BLOCK_A)).toBe(ALICE.id);
		expect(svc.lockHolder(WS, PAGE, BLOCK_B)).toBeNull();
	});

	it("releases the lock when the user heartbeats with a different focus", () => {
		const svc = createPresenceService({ now: clock.now });
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: BLOCK_A,
		});
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: BLOCK_B,
		});
		expect(svc.lockHolder(WS, PAGE, BLOCK_A)).toBeNull();
		expect(svc.lockHolder(WS, PAGE, BLOCK_B)).toBe(ALICE.id);
	});

	it("evicts presence after the presence TTL elapses without a heartbeat", () => {
		const svc = createPresenceService({
			now: clock.now,
			presenceTtlMs: 30_000,
			lockTtlMs: 10_000,
		});
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: BLOCK_A,
		});

		clock.advance(31_000);
		svc.sweep();

		expect(svc.presence(WS, PAGE)).toEqual([]);
		expect(svc.lockHolder(WS, PAGE, BLOCK_A)).toBeNull();
	});

	it("releases a lock after the lock TTL even if presence is still alive", () => {
		const svc = createPresenceService({
			now: clock.now,
			presenceTtlMs: 30_000,
			lockTtlMs: 10_000,
		});
		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: BLOCK_A,
		});
		clock.advance(11_000); // past lock TTL, within presence TTL
		expect(svc.lockHolder(WS, PAGE, BLOCK_A)).toBeNull();
		// Alice should still appear in presence
		expect(svc.presence(WS, PAGE).map((p) => p.userId)).toEqual([ALICE.id]);
	});

	it("notifies subscribers when a heartbeat changes presence on the page", () => {
		const svc = createPresenceService({ now: clock.now });
		const events: PresenceEvent[] = [];
		svc.subscribe(WS, PAGE, ALICE.id, (e) => events.push(e));

		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: BOB,
			focusedBlockId: null,
		});

		expect(events.some((e) => e.type === "presence.changed")).toBe(true);
	});

	it("does not deliver a subscriber its own presence events", () => {
		const svc = createPresenceService({ now: clock.now });
		const events: PresenceEvent[] = [];
		svc.subscribe(WS, PAGE, ALICE.id, (e) => events.push(e));

		svc.heartbeat({
			workspaceId: WS,
			pageId: PAGE,
			user: ALICE,
			focusedBlockId: null,
		});
		expect(events.length).toBe(0);
	});

	it("broadcasts block updates to subscribers of the page", () => {
		const svc = createPresenceService({ now: clock.now });
		const events: PresenceEvent[] = [];
		svc.subscribe(WS, PAGE, BOB.id, (e) => events.push(e));

		svc.broadcast(WS, PAGE, {
			type: "block.updated",
			actorUserId: ALICE.id,
			blockId: BLOCK_A,
			content: "<p>hi</p>",
		});
		expect(events).toEqual([
			{
				type: "block.updated",
				actorUserId: ALICE.id,
				blockId: BLOCK_A,
				content: "<p>hi</p>",
			},
		]);
	});

	it("does not broadcast block updates to the actor that caused them", () => {
		const svc = createPresenceService({ now: clock.now });
		const events: PresenceEvent[] = [];
		svc.subscribe(WS, PAGE, ALICE.id, (e) => events.push(e));

		svc.broadcast(WS, PAGE, {
			type: "block.updated",
			actorUserId: ALICE.id,
			blockId: BLOCK_A,
			content: "<p>hi</p>",
		});
		expect(events).toEqual([]);
	});

	it("unsubscribe stops further delivery", () => {
		const svc = createPresenceService({ now: clock.now });
		const events: PresenceEvent[] = [];
		const unsub = svc.subscribe(WS, PAGE, BOB.id, (e) => events.push(e));

		unsub();
		svc.broadcast(WS, PAGE, {
			type: "block.updated",
			actorUserId: ALICE.id,
			blockId: BLOCK_A,
			content: "<p>hi</p>",
		});
		expect(events.length).toBe(0);
	});
});
