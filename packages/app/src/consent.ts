/**
 * GDPR-aligned consent state for non-essential storage (analytics).
 *
 * Rules we follow:
 *   - Opt-in: nothing analytical loads until the user explicitly accepts.
 *   - Reject is equally easy to Accept (one click, no scroll, no dark pattern).
 *   - Withdrawal: clearing `notara_consent` returns the user to the un-decided
 *     state on next page load.
 *   - Persistence: a single localStorage key, no third-party SDK.
 */

import { initAnalytics } from "./analytics.js";

const STORAGE_KEY = "notara_consent";
export const CONSENT_EVENT = "notara:consent-change";

export type ConsentDecision = "accepted" | "rejected";

export function getConsent(): ConsentDecision | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw === "accepted" || raw === "rejected") return raw;
	} catch {
		/* localStorage disabled (private mode, quota) — treat as no decision. */
	}
	return null;
}

export function setConsent(decision: ConsentDecision): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, decision);
	} catch {
		/* same as above */
	}
	window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: decision }));
}

/**
 * Idempotent: only fires `initAnalytics()` if consent was granted. Safe to
 * call from multiple places (banner accept, page load with prior consent).
 */
export function enableAnalyticsIfConsented(): void {
	if (getConsent() === "accepted") initAnalytics();
}
