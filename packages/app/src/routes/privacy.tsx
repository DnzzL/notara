import { createRoute, Link } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";

const LAST_UPDATED = "2026-06-02";

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
          This policy explains what personal data Notara collects, why, on what legal
          basis, and what rights you have over it. It is written to comply with the
          EU General Data Protection Regulation (GDPR).
        </p>

        <h2>1. Who is the data controller?</h2>
        <p>
          Thomas Legrand, operating Notara as a sole developer.
          Contact: <a href="mailto:thomas.legrand@freelancerepublik.com">thomas.legrand@freelancerepublik.com</a>.
        </p>

        <h2>2. What data we collect, and why</h2>

        <h3>2.1 Account data</h3>
        <ul>
          <li><strong>Email address and name</strong> — to identify you, send authentication emails, and contact you about your account.</li>
          <li><strong>Hashed password</strong> (if you sign up with email) — to authenticate you. We never see your clear-text password.</li>
          <li><strong>Google account ID</strong> (if you sign in with Google) — to authenticate you. We do not request access to your Drive, Gmail, or contacts.</li>
        </ul>
        <p><strong>Legal basis:</strong> performance of contract (Art. 6(1)(b) GDPR).</p>

        <h3>2.2 Content data</h3>
        <ul>
          <li><strong>Pages, blocks, databases, files you upload</strong> — to provide the product. This data lives in a SQLite file specific to your workspace and is not shared across workspaces.</li>
        </ul>
        <p><strong>Legal basis:</strong> performance of contract (Art. 6(1)(b) GDPR).</p>

        <h3>2.3 Product analytics (with consent only)</h3>
        <ul>
          <li><strong>PostHog events</strong> — page views, clicks, signup, workspace creation, page creation, checkout clicks. We use this to understand how to improve onboarding and conversion.</li>
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

        <h3>2.4 Server logs</h3>
        <ul>
          <li><strong>Error reports</strong> — when something breaks server-side we capture a stack trace via PostHog so we can fix it.</li>
          <li><strong>HTTP access logs</strong> — IP address (truncated where feasible), method, path, response code, retained for 30 days for abuse prevention.</li>
        </ul>
        <p><strong>Legal basis:</strong> legitimate interest (Art. 6(1)(f) GDPR), namely keeping the service reliable and secure.</p>

        <h2>3. Cookies and similar technologies</h2>
        <p>We use the following first-party storage:</p>
        <ul>
          <li><strong>Authentication cookies</strong> (Better Auth session) — strictly necessary, no consent required.</li>
          <li><strong>Workspace preference local storage</strong> — strictly necessary.</li>
          <li><strong>PostHog analytics cookies and local storage</strong> — optional, set only after consent.</li>
        </ul>
        <p>We do not use third-party advertising cookies. We do not use cross-site trackers.</p>

        <h2>4. Where data lives</h2>
        <p>
          Notara is a self-hosted product. If you purchased Notara and run it on your own server,
          you are the controller for your users' data; we do not see or store anything you put
          inside it. The information above only applies to the <strong>notara.app marketing site</strong> and the
          (forthcoming) hosted cloud version, both operated by us.
        </p>
        <p>Servers and PostHog data centers are located within the EU (Frankfurt / Germany).</p>

        <h2>5. Data retention</h2>
        <ul>
          <li>Account data: kept while your account exists, deleted within 30 days of account deletion.</li>
          <li>Content data: kept while your workspace exists, deleted within 30 days of workspace deletion (soft-delete + trash sweep).</li>
          <li>Analytics events: retained for 12 months.</li>
          <li>Server logs: retained for 30 days.</li>
        </ul>

        <h2>6. Your rights under GDPR</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> a copy of your personal data (Art. 15).</li>
          <li><strong>Rectify</strong> inaccurate data (Art. 16).</li>
          <li><strong>Erase</strong> your data — the "right to be forgotten" (Art. 17).</li>
          <li><strong>Restrict</strong> processing in certain circumstances (Art. 18).</li>
          <li><strong>Portability</strong> — receive your data in a machine-readable format (Art. 20). Notara's export feature already provides this for your content.</li>
          <li><strong>Object</strong> to processing based on legitimate interest (Art. 21).</li>
          <li><strong>Withdraw consent</strong> for analytics at any time, with no effect on processing done before withdrawal.</li>
          <li><strong>Lodge a complaint</strong> with your local supervisory authority (in France: <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>).</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:thomas.legrand@freelancerepublik.com">thomas.legrand@freelancerepublik.com</a>.
          We will respond within 30 days.
        </p>

        <h2>7. Children</h2>
        <p>Notara is not intended for users under 16. We do not knowingly collect data from children.</p>

        <h2>8. Changes to this policy</h2>
        <p>
          If we materially change this policy we will update the date at the top and, for
          account holders, notify you by email. The latest version always lives at this URL.
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
