import { posthog } from "posthog-js";

const key = (import.meta as any).env?.VITE_POSTHOG_KEY as string | undefined;
const host =
  ((import.meta as any).env?.VITE_POSTHOG_HOST as string | undefined) ??
  "https://eu.i.posthog.com";

let initialized = false;

export function initAnalytics(): void {
  if (initialized || !key) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: "history_change",
    autocapture: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

/** Track a frontend event. No-op if PostHog isn't configured. */
export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/** Tie subsequent frontend events to a known user (call after sign-in). */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

/** Forget the current user on sign-out so the next session is anonymous. */
export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}
