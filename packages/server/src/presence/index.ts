import { createPresenceService } from "./PresenceService.js";

/**
 * Process-wide singleton. Collaboration state is ephemeral by design —
 * a server restart is recovered by client heartbeats within seconds.
 */
export const presence = createPresenceService();

// Periodic sweep — drop entries past TTL.
const sweepHandle = setInterval(() => presence.sweep(), 5_000);
if (typeof sweepHandle === "object" && "unref" in sweepHandle) {
  (sweepHandle as NodeJS.Timeout).unref();
}

export * from "./PresenceService.js";
