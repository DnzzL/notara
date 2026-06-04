import { createRoute, Link } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";

const LAST_UPDATED = "2026-06-04";

function PrivacyPage() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/" className="legal-back">← Notara</Link>
      </nav>
      <article className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

        <p>
          This policy explains what personal data is collected when you visit <strong>notara.app</strong>,
          why, on what legal basis, and what rights you have over it. It is written to comply with the
          EU General Data Protection Regulation (GDPR).
        </p>

        <h2>1. Scope of this policy</h2>
        <p>
          Notara is a <strong>self-hosted product</strong>. When you purchase a license and run Notara
          on your own machine or server, all data you create inside it stays entirely under your
          control — we have no access to it and this policy does not apply to it.
        </p>
        <p>
          This policy only covers the <strong>notara.app marketing website</strong>, operated by
          Thomas Legrand. We do not currently offer a hosted cloud version of Notara.
        </p>

        <h2>2. Who is the data controller?</h2>
        <p>
          Thomas Legrand, sole developer of Notara.
          Contact: <a href="mailto:legrand.thomas5@hotmail.fr">legrand.thomas5@hotmail.fr</a>.
        </p>

        <h2>3. What data we collect on notara.app, and why</h2>

        <h3>3.1 Product analytics (with consent only)</h3>
        <ul>
          <li><strong>PostHog events</strong> — page views, clicks, and checkout interactions. We use this to understand how to improve the landing page and conversion funnel.</li>
        </ul>
        <p>
          <strong>Legal basis:</strong> consent (Art. 6(1)(a) GDPR). Analytics are <em>only</em> enabled
          after you accept the cookie banner. You can withdraw consent at any time by clearing the
          <code> notara_consent </code> entry in your browser's local storage, or by emailing us.
        </p>
        <p>
          PostHog is hosted in the EU (eu.i.posthog.com). We do not enable session replay.
          We do not share analytics data with third parties for advertising.
        </p>

        <h3>3.2 Contact emails</h3>
        <p>
          If you email us directly, we receive your email address and message content solely to
          respond to your enquiry.
        </p>
        <p><strong>Legal basis:</strong> legitimate interest (Art. 6(1)(f) GDPR).</p>

        <h2>4. Cookies and similar technologies</h2>
        <p>We use the following first-party storage on notara.app:</p>
        <ul>
          <li><strong>notara_consent</strong> (local storage) — records your analytics consent choice. Strictly necessary to honour your preference.</li>
          <li><strong>PostHog analytics cookies and local storage</strong> — optional, set only after consent.</li>
        </ul>
        <p>We do not use third-party advertising cookies. We do not use cross-site trackers.</p>

        <h2>5. Data retention</h2>
        <ul>
          <li>Analytics events: retained for 12 months in PostHog, then deleted.</li>
          <li>Contact emails: kept only as long as needed to handle your enquiry.</li>
        </ul>

        <h2>6. Your rights under GDPR</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> a copy of your personal data (Art. 15).</li>
          <li><strong>Rectify</strong> inaccurate data (Art. 16).</li>
          <li><strong>Erase</strong> your data — the "right to be forgotten" (Art. 17).</li>
          <li><strong>Restrict</strong> processing in certain circumstances (Art. 18).</li>
          <li><strong>Object</strong> to processing based on legitimate interest (Art. 21).</li>
          <li><strong>Withdraw consent</strong> for analytics at any time, with no effect on processing done before withdrawal.</li>
          <li><strong>Lodge a complaint</strong> with your local supervisory authority (in France: <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>).</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:legrand.thomas5@hotmail.fr">legrand.thomas5@hotmail.fr</a>.
          We will respond within 30 days.
        </p>

        <h2>7. Children</h2>
        <p>Notara is not intended for users under 16. We do not knowingly collect data from children.</p>

        <h2>8. Changes to this policy</h2>
        <p>
          If we materially change this policy we will update the date at the top.
          The latest version always lives at this URL.
        </p>
      </article>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
});
