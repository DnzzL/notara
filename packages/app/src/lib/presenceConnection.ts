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
import { usePresenceStore } from "../stores/presenceStore.js";
import { useBlockStore } from "../stores/blockStore.js";
import type { Block } from "@notara/shared";

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
  | { type: "presence.changed"; users: Array<{ userId: string; name: string; focusedBlockId: string | null }> }
  | { type: "block.updated"; actorUserId: string; blockId: string; content: string }
  | { type: "block.created"; actorUserId: string; block: Block }
  | { type: "block.deleted"; actorUserId: string; blockId: string }
  | { type: "block.reordered"; actorUserId: string; blockIds: string[] }
  | { type: "page.metaUpdated"; actorUserId: string; fields: Record<string, unknown> };

const HEARTBEAT_INTERVAL_MS = 5_000;

type Connection = {
  workspaceId: string;
  pageId: string;
  selfUserId: string;
  source: EventSource | null;
  timer: ReturnType<typeof setInterval> | null;
  focusedBlockId: string | null;
  stopped: boolean;
};

let active: Connection | null = null;

async function sendHeartbeat(c: Connection) {
  try {
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
  };
  active = c;

  // Initial heartbeat populates presence on first tick.
  void sendHeartbeat(c);

  c.timer = setInterval(() => { void sendHeartbeat(c); }, HEARTBEAT_INTERVAL_MS);

  const url = `/api/presence/stream?workspaceId=${encodeURIComponent(args.workspaceId)}&pageId=${encodeURIComponent(args.pageId)}`;
  const source = new EventSource(url, { withCredentials: true });
  c.source = source;

  source.addEventListener("open", () => { usePresenceStore.getState().setStatus("open"); });

  source.addEventListener("error", () => { usePresenceStore.getState().setStatus("closed"); });

  source.addEventListener("presence.changed", (ev) => {
    const e = JSON.parse((ev as MessageEvent).data) as Extract<PresenceEvent, { type: "presence.changed" }>;
    usePresenceStore.getState().setOthers(e.users, args.selfUserId);
  });

  source.addEventListener("block.updated", (ev) => {
    const e = JSON.parse((ev as MessageEvent).data) as Extract<PresenceEvent, { type: "block.updated" }>;
    if (e.actorUserId === args.selfUserId) return;
    args.onBlockUpdated?.(e.blockId, e.content);
    // Mirror into the block store so other readers stay consistent.
    useBlockStore.setState((s) => ({
      blocks: s.blocks.map((b) => (b.id === e.blockId ? { ...b, content: e.content } : b)),
    }));
  });

  source.addEventListener("block.created", (ev) => {
    const e = JSON.parse((ev as MessageEvent).data) as Extract<PresenceEvent, { type: "block.created" }>;
    if (e.actorUserId === args.selfUserId) return;
    args.onBlockCreated?.(e.block);
    useBlockStore.setState((s) => {
      if (s.blocks.some((b) => b.id === e.block.id)) return s;
      const next = [...s.blocks, e.block].sort((a, b) => a.index - b.index);
      return { blocks: next };
    });
  });

  source.addEventListener("block.deleted", (ev) => {
    const e = JSON.parse((ev as MessageEvent).data) as Extract<PresenceEvent, { type: "block.deleted" }>;
    if (e.actorUserId === args.selfUserId) return;
    args.onBlockDeleted?.(e.blockId);
    useBlockStore.setState((s) => ({ blocks: s.blocks.filter((b) => b.id !== e.blockId) }));
  });

  source.addEventListener("block.reordered", (ev) => {
    const e = JSON.parse((ev as MessageEvent).data) as Extract<PresenceEvent, { type: "block.reordered" }>;
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
    const e = JSON.parse((ev as MessageEvent).data) as Extract<PresenceEvent, { type: "page.metaUpdated" }>;
    if (e.actorUserId === args.selfUserId) return;
    args.onPageMetaUpdated?.(e.fields);
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
  active = null;
  usePresenceStore.getState().reset();
}
