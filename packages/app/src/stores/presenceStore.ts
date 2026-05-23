import { create } from "zustand";

export type UserPresence = {
  userId: string;
  name: string;
  focusedBlockId: string | null;
};

export interface PresenceState {
  /** Users present on the current page (excluding self). */
  others: UserPresence[];
  /** Lock map for the current page: blockId → userId of the holder (others only). */
  locks: Map<string, string>;
  /** SSE connection status. */
  status: "idle" | "connecting" | "open" | "closed";

  setOthers: (users: UserPresence[], selfUserId: string) => void;
  setStatus: (status: PresenceState["status"]) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  others: [],
  locks: new Map(),
  status: "idle",

  setOthers: (users, selfUserId) => {
    const others = users.filter((u) => u.userId !== selfUserId);
    const locks = new Map<string, string>();
    for (const u of others) {
      if (u.focusedBlockId) locks.set(u.focusedBlockId, u.userId);
    }
    set({ others, locks });
  },

  setStatus: (status) => set({ status }),

  reset: () => set({ others: [], locks: new Map(), status: "idle" }),
}));
