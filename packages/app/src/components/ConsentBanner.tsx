import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  getConsent,
  setConsent,
  enableAnalyticsIfConsented,
  CONSENT_EVENT,
  type ConsentDecision,
} from "../consent.js";

/**
 * Bottom-anchored consent banner. Stays out of the way (not modal) — the user
 * can still read the page while it's shown. Reject is given the same visual
 * weight as Accept per GDPR guidance: opt-in must be a free, equal choice.
 */
export function ConsentBanner() {
  const [decision, setDecisionState] = useState<ConsentDecision | null>(() => getConsent());

  useEffect(() => {
    // If consent was already granted in a previous session, ensure PostHog is
    // initialised now (the app may have rendered before consent was read).
    if (decision === "accepted") enableAnalyticsIfConsented();

    const onChange = () => setDecisionState(getConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, [decision]);

  if (decision !== null) return null;

  const choose = (next: ConsentDecision) => {
    setConsent(next);
    setDecisionState(next);
    if (next === "accepted") enableAnalyticsIfConsented();
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="consent-banner-body"
      className="consent-banner"
    >
      <div className="consent-banner-inner">
        <div id="consent-banner-body" className="consent-banner-text">
          <strong>Cookies, briefly:</strong>{" "}
          we use a single privacy-friendly analytics tool (PostHog, hosted in the EU) to learn what
          works on this page. Everything you do here stays optional. Read the details in our{" "}
          <Link to="/privacy">privacy policy</Link>.
        </div>
        <div className="consent-banner-actions">
          <button
            type="button"
            className="consent-btn consent-btn-secondary"
            onClick={() => choose("rejected")}
            aria-label="Reject analytics cookies"
          >
            Reject
          </button>
          <button
            type="button"
            className="consent-btn consent-btn-primary"
            onClick={() => choose("accepted")}
            aria-label="Accept analytics cookies"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
