import { createRoute, Link } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";

const LAST_UPDATED = "2026-07-01";

function TermsPage() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/" className="legal-back">← Notara</Link>
      </nav>
      <article className="legal-content">
        <h1>Terms of Service</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>

        <p>
          These terms govern your use of the Notara marketing site and any hosted services
          operated by Thomas Legrand (sole developer, "we"). Your separate license to the
          Notara software is covered by the <a href="https://github.com/dnzzl/notara/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">LICENSE</a> file
          in the source repository, not by this document.
        </p>

        <h2>1. The service</h2>
        <p>
          Notara is a fair-source, self-hostable Notion alternative. It is free to self-host
          under the Functional Source License (FSL-1.1-ALv2): the source lives in a public
          GitHub repository, and you may run, modify, and redistribute it — including for
          commercial use — provided you do not offer it as a competing hosted service. Each
          release additionally converts to the Apache License 2.0 two years after it ships.
          The full terms are in <code>LICENSE</code> in the source tree.
        </p>

        <h2>2. Account creation</h2>
        <p>
          You must provide accurate information when creating an account. You are responsible
          for keeping your password secure and for everything that happens under your account.
          You must be at least 16 years old.
        </p>

        <h2>3. Acceptable use</h2>
        <p>You agree not to use Notara to:</p>
        <ul>
          <li>Violate any law, regulation, or third party's rights.</li>
          <li>Send spam, malware, or unsolicited communications.</li>
          <li>Attempt to gain unauthorized access to other accounts or our infrastructure.</li>
          <li>Reverse-engineer the software except as allowed by the license.</li>
        </ul>

        <h2>4. Payments</h2>
        <p>
          Notara is free to self-host — the marketing site sells nothing and we take no payment
          for the software. Your rights to the source are granted by the FSL-1.1-ALv2 licence,
          not by a purchase.
        </p>

        <h2>5. Updates and changes</h2>
        <p>
          We may push updates to the public source repository at any time; they are available
          to everyone under the licence. We may change the product in ways that require migration;
          we will document those migrations in the release notes.
        </p>

        <h2>6. Service availability</h2>
        <p>
          The marketing site and (future) hosted cloud version are provided "as is" without
          any uptime guarantee. We aim for best-effort availability and will be transparent
          when things break.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, our aggregate liability arising from or
          related to your use of Notara is limited to the amount you paid us in the 12 months
          before the event giving rise to the claim. We are not liable for indirect, incidental,
          consequential, or punitive damages.
        </p>

        <h2>8. Termination</h2>
        <p>
          You may close your account at any time. We may suspend or terminate accounts that
          breach these terms, after notice where reasonable. License rights to the source code
          you have already received continue under the terms of the LICENSE file even if your
          account is closed.
        </p>

        <h2>9. Governing law</h2>
        <p>
          These terms are governed by the laws of France. Any dispute that cannot be resolved
          amicably falls under the exclusive jurisdiction of the courts of Paris, France.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:legrand.thomas5@hotmail.fr">legrand.thomas5@hotmail.fr</a>.
        </p>
      </article>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: TermsPage,
});
