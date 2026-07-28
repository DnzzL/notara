/**
 * In-memory presence + soft-lock store. One instance per server process.
 *
 * Lifecycle: clients heartbeat every ~5s carrying { workspaceId, pageId,
 * focusedBlockId }. Presence and lock TTLs are independent so the page-avatar
 * list lingers a bit longer than the per-block lock — see `sweep` + `lockHolder`.
 */

export type PresenceUser = { id: string; name: string };

export type UserPresence = {
	userId: string;
	name: string;
	focusedBlockId: string | null;
};

export type PresenceEvent =
	| { type: "presence.changed"; users: UserPresence[] }
	| {
			type: "block.updated";
			actorUserId: string;
			blockId: string;
			content: string;
	  }
	| { type: "block.created"; actorUserId: string; block: unknown }
	| { type: "block.deleted"; actorUserId: string; blockId: string }
	| { type: "block.reordered"; actorUserId: string; blockIds: string[] }
	| {
			type: "page.metaUpdated";
			actorUserId: string;
			fields: Record<string, unknown>;
	  };

type Subscriber = {
	userId: string;
	push: (e: PresenceEvent) => void;
};

type Entry = {
	user: PresenceUser;
	focusedBlockId: string | null;
	presenceAt: number;
	focusAt: number;
};

export type PresenceServiceOptions = {
	now?: () => number;
	presenceTtlMs?: number;
	lockTtlMs?: number;
};

export type PresenceService = ReturnType<typeof createPresenceService>;

const DEFAULT_PRESENCE_TTL = 30_000;
const DEFAULT_LOCK_TTL = 10_000;

export function createPresenceService(opts: PresenceServiceOptions = {}) {
	const now = opts.now ?? (() => Date.now());
	const presenceTtl = opts.presenceTtlMs ?? DEFAULT_PRESENCE_TTL;
	const lockTtl = opts.lockTtlMs ?? DEFAULT_LOCK_TTL;

	const key = (ws: string, page: string) => `${ws}::${page}`;
	const entries = new Map<string, Map<string, Entry>>();
	const subscribers = new Map<string, Set<Subscriber>>();

	function snapshot(ws: string, page: string): UserPresence[] {
		const pageMap = entries.get(key(ws, page));
		if (!pageMap) return [];
		const t = now();
		const out: UserPresence[] = [];
		for (const e of pageMap.values()) {
			if (t - e.presenceAt > presenceTtl) continue;
			const focusAlive = e.focusedBlockId !== null && t - e.focusAt <= lockTtl;
			out.push({
				userId: e.user.id,
				name: e.user.name,
				focusedBlockId: focusAlive ? e.focusedBlockId : null,
			});
		}
		return out;
	}

	function emit(
		ws: string,
		page: string,
		event: PresenceEvent,
		excludeUserId: string | null,
	) {
		const subs = subscribers.get(key(ws, page));
		if (!subs) return;
		for (const s of subs) {
			if (excludeUserId !== null && s.userId === excludeUserId) continue;
			try {
				s.push(event);
			} catch {
				/* subscriber errors don't break the broadcaster */
			}
		}
	}

	return {
		heartbeat(input: {
			workspaceId: string;
			pageId: string;
			user: PresenceUser;
			focusedBlockId: string | null;
		}) {
			const k = key(input.workspaceId, input.pageId);
			let pageMap = entries.get(k);
			if (!pageMap) {
				pageMap = new Map();
				entries.set(k, pageMap);
			}
			const t = now();
			const prev = pageMap.get(input.user.id);
			const focusChanged =
				!prev || prev.focusedBlockId !== input.focusedBlockId;
			pageMap.set(input.user.id, {
				user: input.user,
				focusedBlockId: input.focusedBlockId,
				presenceAt: t,
				focusAt: input.focusedBlockId !== null ? t : 0,
			});
			// Notify everyone *else* that presence on this page changed
			if (!prev || focusChanged) {
				emit(
					input.workspaceId,
					input.pageId,
					{
						type: "presence.changed",
						users: snapshot(input.workspaceId, input.pageId),
					},
					input.user.id,
				);
			}
		},

		presence(workspaceId: string, pageId: string): UserPresence[] {
			return snapshot(workspaceId, pageId);
		},

		lockHolder(
			workspaceId: string,
			pageId: string,
			blockId: string,
		): string | null {
			const pageMap = entries.get(key(workspaceId, pageId));
			if (!pageMap) return null;
			const t = now();
			for (const e of pageMap.values()) {
				if (e.focusedBlockId !== blockId) continue;
				if (t - e.focusAt > lockTtl) continue;
				if (t - e.presenceAt > presenceTtl) continue;
				return e.user.id;
			}
			return null;
		},

		subscribe(
			workspaceId: string,
			pageId: string,
			userId: string,
			push: (e: PresenceEvent) => void,
		) {
			const k = key(workspaceId, pageId);
			let set = subscribers.get(k);
			if (!set) {
				set = new Set();
				subscribers.set(k, set);
			}
			const sub: Subscriber = { userId, push };
			set.add(sub);
			return () => {
				set?.delete(sub);
				if (set?.size === 0) subscribers.delete(k);
			};
		},

		broadcast(workspaceId: string, pageId: string, event: PresenceEvent) {
			const actor =
				event.type === "presence.changed" ? null : event.actorUserId;
			emit(workspaceId, pageId, event, actor);
		},

		sweep() {
			const t = now();
			for (const [k, pageMap] of entries) {
				for (const [uid, e] of pageMap) {
					if (t - e.presenceAt > presenceTtl) pageMap.delete(uid);
				}
				if (pageMap.size === 0) entries.delete(k);
			}
		},
	};
}
