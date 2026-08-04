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
	/** Keyed by `key(ws, page)`; the pair is kept so sweeps can address the page. */
	const entries = new Map<
		string,
		{ ws: string; page: string; users: Map<string, Entry> }
	>();
	const subscribers = new Map<string, Set<Subscriber>>();

	function snapshot(ws: string, page: string): UserPresence[] {
		const pageMap = entries.get(key(ws, page))?.users;
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
			let entry = entries.get(k);
			if (!entry) {
				entry = {
					ws: input.workspaceId,
					page: input.pageId,
					users: new Map(),
				};
				entries.set(k, entry);
			}
			const pageMap = entry.users;
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
			const pageMap = entries.get(key(workspaceId, pageId))?.users;
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

		/**
		 * Drop a user from a page and tell whoever is left. Called when the client
		 * reports it has stopped watching the page. Without this the departing
		 * user's entry would sit there until the TTL, and nobody would be told.
		 *
		 * A user with two tabs on the same page briefly disappears when one
		 * closes; the surviving tab's next heartbeat (≤5s) puts them back.
		 */
		leave(workspaceId: string, pageId: string, userId: string) {
			const k = key(workspaceId, pageId);
			const entry = entries.get(k);
			if (!entry?.users.delete(userId)) return;
			emit(
				workspaceId,
				pageId,
				{
					type: "presence.changed",
					users: snapshot(workspaceId, pageId),
				},
				null,
			);
			if (entry.users.size === 0) entries.delete(k);
		},

		/**
		 * Evict entries whose presence TTL lapsed. Emits per page that lost
		 * someone so remaining viewers stop showing avatars for users who
		 * vanished without reporting a departure.
		 */
		sweep() {
			const t = now();
			for (const [k, entry] of entries) {
				let evicted = false;
				for (const [uid, e] of entry.users) {
					if (t - e.presenceAt > presenceTtl) {
						entry.users.delete(uid);
						evicted = true;
					}
				}
				if (evicted) {
					emit(
						entry.ws,
						entry.page,
						{
							type: "presence.changed",
							users: snapshot(entry.ws, entry.page),
						},
						null,
					);
				}
				if (entry.users.size === 0) entries.delete(k);
			}
		},
	};
}
