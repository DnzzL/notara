import { posthog } from "posthog-js";

const key = (import.meta as any).env?.VITE_POSTHOG_KEY as string | undefined;
const host =
  ((import.meta as any).env?.VITE_POSTHOG_HOST as string | undefined) ??
  "https://eu.i.posthog.com";

let initialized = false;

export function initAnalytics(): void {
  if (initialized || !key) return;
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: host,
    capture_pageview: "history_change",
    capture_exceptions: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    defaults: "2026-01-30",
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

/** Capture an exception for PostHog error tracking. No-op if not configured. */
export function captureException(err: unknown): void {
  if (!initialized) return;
  posthog.captureException(err instanceof Error ? err : new Error(String(err)));
}
