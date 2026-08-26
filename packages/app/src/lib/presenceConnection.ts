/**
 * Per-open-page presence lifecycle: heartbeats out, SSE in.
 *
 * Lifecycle:
 *   - start({ workspaceId, pageId, selfUserId }) → opens EventSource + heartbeat timer
 *   - setFocusedBlock(blockId | null) → updates client state and fires an immediate heartbeat
 *   - stop() → closes EventSource and timer
 *
 * No auto-reconnect on auth failure; EventSource handles transient drops automatically.
 */

import { type Block, Page } from "@notara/shared";
import { useBlockStore } from "../stores/blockStore.js";
import { usePageStore } from "../stores/pageStore.js";
import { usePresenceStore } from "../stores/presenceStore.js";

type StartArgs = {
	workspaceId: string;
	pageId: string;
	selfUserId: string;
	onBlockCreated?: (block: Block) => void;
	onBlockDeleted?: (blockId: string) => void;
	onBlockReordered?: (blockIds: string[]) => void;
	onBlockUpdated?: (blockId: string, content: string) => void;
	onPageMetaUpdated?: (fields: Record<string, unknown>) => void;
};

type PresenceEvent =
	| {
			type: "presence.changed";
			users: Array<{
				userId: string;
				name: string;
				focusedBlockId: string | null;
			}>;
	  }
	| {
			type: "block.updated";
			actorUserId: string;
			blockId: string;
			content: string;
	  }
	| { type: "block.created"; actorUserId: string; block: Block }
	| { type: "block.deleted"; actorUserId: string; blockId: string }
	| { type: "block.reordered"; actorUserId: string; blockIds: string[] }
	| {
			type: "page.metaUpdated";
			actorUserId: string;
			fields: Record<string, unknown>;
	  };

const HEARTBEAT_INTERVAL_MS = 5_000;

type Connection = {
	workspaceId: string;
	pageId: string;
	selfUserId: string;
	source: EventSource | null;
	timer: ReturnType<typeof setInterval> | null;
	focusedBlockId: string | null;
	stopped: boolean;
	onPageHide: ((e: PageTransitionEvent) => void) | null;
};

let active: Connection | null = null;

async function sendHeartbeat(c: Connection) {
	// A heartbeat that outlives the leave would resurrect us on the page peers
	// just watched us leave.
	if (c.stopped) return;
	try {
		// Raw fetch on purpose: a heartbeat that fails is not worth telling the
		// user about, and the transport reports failures.
		await fetch("/api/presence/heartbeat", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workspaceId: c.workspaceId,
				pageId: c.pageId,
				focusedBlockId: c.focusedBlockId,
			}),
		});
	} catch {
		// Network drops are non-fatal; the next interval will retry.
	}
}

/**
 * Tell the server we are no longer on this page, so peers stop seeing our
 * avatar. Without this the entry would linger until the presence TTL.
 *
 * `keepalive` so the request outlives a document being torn down. Note this
 * still loses the race against a cross-document navigation (the browser aborts
 * it); the server's TTL sweep is the backstop for that. navigator.sendBeacon,
 * the obvious tool here, is aborted in that case too.
 *
 * A repeated leave is a no-op server-side, so firing from more than one path is
 * safe.
 */
function sendLeave(c: Connection) {
	// Silence the heartbeat first, otherwise the interval keeps firing while the
	// document is torn down and the last one lands after this leave.
	c.stopped = true;
	if (c.timer) {
		clearInterval(c.timer);
		c.timer = null;
	}
	try {
		// Raw fetch on purpose: this fires on page unload with keepalive, where
		// nothing is left to catch a rejection.
		void fetch("/api/presence/leave", {
			method: "POST",
			keepalive: true,
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ workspaceId: c.workspaceId, pageId: c.pageId }),
		}).catch(() => {
			// Unreachable server: the presence TTL sweep still expires us.
		});
	} catch {
		// Same.
	}
}

export function startPresence(args: StartArgs) {
	stopPresence();
	const store = usePresenceStore.getState();
	store.setStatus("connecting");

	const c: Connection = {
		workspaceId: args.workspaceId,
		pageId: args.pageId,
		selfUserId: args.selfUserId,
		source: null,
		timer: null,
		focusedBlockId: null,
		stopped: false,
		onPageHide: null,
	};
	active = c;

	// Closing the tab tears the document down without running React cleanup, so
	// the departure is announced here too. `persisted` means the page is going
	// into the back/forward cache and may be restored with this connection still
	// live — leaving then would strand a returning user as invisible to peers,
	// and the TTL sweep already covers them if they never come back.
	c.onPageHide = (e: PageTransitionEvent) => {
		if (!e.persisted) sendLeave(c);
	};
	window.addEventListener("pagehide", c.onPageHide);

	// Initial heartbeat populates presence on first tick.
	void sendHeartbeat(c);

	c.timer = setInterval(() => {
		void sendHeartbeat(c);
	}, HEARTBEAT_INTERVAL_MS);

	const url = `/api/presence/stream?workspaceId=${encodeURIComponent(args.workspaceId)}&pageId=${encodeURIComponent(args.pageId)}`;
	const source = new EventSource(url, { withCredentials: true });
	c.source = source;

	source.addEventListener("open", () => {
		usePresenceStore.getState().setStatus("open");
	});

	source.addEventListener("error", () => {
		usePresenceStore.getState().setStatus("closed");
	});

	source.addEventListener("presence.changed", (ev) => {
		const e = JSON.parse((ev as MessageEvent).data) as Extract<
			PresenceEvent,
			{ type: "presence.changed" }
		>;
		usePresenceStore.getState().setOthers(e.users, args.selfUserId);
	});

	source.addEventListener("block.updated", (ev) => {
		const e = JSON.parse((ev as MessageEvent).data) as Extract<
			PresenceEvent,
			{ type: "block.updated" }
		>;
		if (e.actorUserId === args.selfUserId) return;
		args.onBlockUpdated?.(e.blockId, e.content);
		// Mirror into the block store so other readers stay consistent.
		useBlockStore.setState((s) => ({
			blocks: s.blocks.map((b) =>
				b.id === e.blockId ? { ...b, content: e.content } : b,
			),
		}));
	});

	source.addEventListener("block.created", (ev) => {
		const e = JSON.parse((ev as MessageEvent).data) as Extract<
			PresenceEvent,
			{ type: "block.created" }
		>;
		if (e.actorUserId === args.selfUserId) return;
		args.onBlockCreated?.(e.block);
		useBlockStore.setState((s) => {
			if (s.blocks.some((b) => b.id === e.block.id)) return s;
			const next = [...s.blocks, e.block].sort((a, b) => a.index - b.index);
			return { blocks: next };
		});
	});

	source.addEventListener("block.deleted", (ev) => {
		const e = JSON.parse((ev as MessageEvent).data) as Extract<
			PresenceEvent,
			{ type: "block.deleted" }
		>;
		if (e.actorUserId === args.selfUserId) return;
		args.onBlockDeleted?.(e.blockId);
		useBlockStore.setState((s) => ({
			blocks: s.blocks.filter((b) => b.id !== e.blockId),
		}));
	});

	source.addEventListener("block.reordered", (ev) => {
		const e = JSON.parse((ev as MessageEvent).data) as Extract<
			PresenceEvent,
			{ type: "block.reordered" }
		>;
		if (e.actorUserId === args.selfUserId) return;
		args.onBlockReordered?.(e.blockIds);
		useBlockStore.setState((s) => {
			const byId = new Map(s.blocks.map((b) => [b.id, b] as const));
			const reordered = e.blockIds
				.map((id, i) => {
					const b = byId.get(id);
					return b ? { ...b, index: i } : null;
				})
				.filter((b): b is NonNullable<typeof b> => b !== null);
			return { blocks: reordered };
		});
	});

	source.addEventListener("page.metaUpdated", (ev) => {
		const e = JSON.parse((ev as MessageEvent).data) as Extract<
			PresenceEvent,
			{ type: "page.metaUpdated" }
		>;
		if (e.actorUserId === args.selfUserId) return;
		args.onPageMetaUpdated?.(e.fields);
		// Mirror into the page store like the block events do — the callback alone
		// left every viewer on the stale title/icon/cover until a reload. The
		// stream is per-page, so the event applies to args.pageId.
		const patch = e.fields as Pick<Page, "title" | "icon" | "coverUrl">;
		usePageStore.setState((s) => ({
			pages: s.pages.map((p) =>
				p.id === args.pageId ? new Page({ ...p, ...patch }) : p,
			),
			currentPage:
				s.currentPage?.id === args.pageId
					? new Page({ ...s.currentPage, ...patch })
					: s.currentPage,
		}));
	});
}

export function setFocusedBlock(blockId: string | null) {
	if (!active) return;
	if (active.focusedBlockId === blockId) return;
	active.focusedBlockId = blockId;
	// Edge-trigger an immediate heartbeat so lock handoff feels instant.
	void sendHeartbeat(active);
}

export function stopPresence() {
	if (!active) return;
	active.stopped = true;
	if (active.timer) clearInterval(active.timer);
	if (active.source) active.source.close();
	if (active.onPageHide)
		window.removeEventListener("pagehide", active.onPageHide);
	sendLeave(active);
	active = null;
	usePresenceStore.getState().reset();
}
