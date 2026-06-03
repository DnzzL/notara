import { useEffect, useRef } from "react";
import { useSession } from "../auth-client.js";
import { identify, resetAnalytics } from "../analytics.js";

/**
 * Bridges the auth session to PostHog's distinct_id. Mounted once at the
 * root: on sign-in it identifies the user (stitching prior anonymous events
 * to the account); on sign-out it resets the distinct_id so the next
 * anonymous session doesn't leak into the previous user's history.
 *
 * Safe with consent gating: identify/resetAnalytics are no-ops until
 * PostHog has actually been initialised (which only happens after Accept).
 */
export function AnalyticsIdentity() {
  const { data: session } = useSession();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (userId === lastUserId.current) return;

    if (userId) {
      identify(userId, { email_domain: session?.user?.email?.split("@")[1] });
    } else if (lastUserId.current) {
      // Sign-out
      resetAnalytics();
    }
    lastUserId.current = userId;
  }, [session]);

  return null;
}
