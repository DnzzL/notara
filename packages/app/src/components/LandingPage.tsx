import { Link } from "@tanstack/react-router";

const features = [
  {
    icon: "◻",
    title: "Block editor",
    desc: "Paragraphs, headings, todos, code, tables, toggles and more — everything you need to write clearly.",
  },
  {
    icon: "⊞",
    title: "Inline databases",
    desc: "Table and board views live right inside your pages. Filter, sort, relate — no extra app required.",
  },
  {
    icon: "⌘",
    title: "Local-first",
    desc: "All data stays in a single SQLite file on your server. Own your data. No vendor lock-in.",
  },
  {
    icon: "⚑",
    title: "Team workspaces",
    desc: "Invite teammates via link or email. Multiple workspaces, role-based access.",
  },
  {
    icon: "↓",
    title: "Import from Notion",
    desc: "Bring your existing notes and databases in one click. Export back out anytime.",
  },
  {
    icon: "☁",
    title: "S3 backups",
    desc: "Optional encrypted backups to any S3-compatible bucket. Scheduled or manual.",
  },
  {
    icon: "⌁",
    title: "Open REST API",
    desc: "Full HTTP API with API key auth. Automate from scripts, CI pipelines, or any HTTP client. OpenAPI spec included.",
    docsHref: "/api/docs",
  },
];

const plans = [
  {
    name: "Self-hosted",
    price: "Free",
    note: "forever",
    highlight: false,
    features: [
      "Unlimited pages & blocks",
      "Unlimited workspaces",
      "Invite-based team access",
      "S3 backup support",
      "MIT licensed",
    ],
    cta: "Deploy yourself",
    ctaHref: "https://github.com",
    ctaExternal: true,
  },
  {
    name: "Cloud",
    price: "Coming soon",
    note: "",
    highlight: true,
    features: [
      "Everything in Self-hosted",
      "Hosted & managed for you",
      "Automatic updates",
      "Priority support",
    ],
    cta: "Get notified",
    ctaHref: "/login",
    ctaExternal: false,
  },
];

export function LandingPage() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="auth-brand-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.9"/>
                <rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.5"/>
                <rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.5"/>
                <rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.25"/>
              </svg>
            </div>
            <span className="landing-brand-name">Notara</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
            <a href="/api/docs" className="landing-nav-link">API docs</a>
            <Link to="/login" className="landing-nav-cta">Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-badge">Open source · Self-hostable · MIT license</div>
          <h1 className="landing-headline">
            The notes app<br />you actually own
          </h1>
          <p className="landing-sub">
            Notara is a local-first Notion alternative. Block editor, inline databases,
            team workspaces — all in a single file on your own server.
          </p>
          <div className="landing-hero-ctas">
            <Link to="/login" className="landing-cta-primary">Get started free</Link>
            <a href="#features" className="landing-cta-secondary">See features</a>
          </div>
        </div>

        {/* App preview placeholder */}
        <div className="landing-preview">
          <div className="landing-preview-chrome">
            <div className="landing-preview-dots">
              <span/><span/><span/>
            </div>
          </div>
          <div className="landing-preview-body">
            <div className="landing-preview-sidebar">
              {["Getting started", "Projects", "Meeting notes", "Ideas"].map((item) => (
                <div key={item} className="landing-preview-page-item">{item}</div>
              ))}
            </div>
            <div className="landing-preview-content">
              <div className="landing-preview-title">Getting started</div>
              <div className="landing-preview-block landing-preview-block--h2">Welcome to Notara</div>
              <div className="landing-preview-block">Everything you write lives in a single SQLite file.</div>
              <div className="landing-preview-block landing-preview-block--todo">
                <span className="landing-preview-checkbox"/>Import your Notion export
              </div>
              <div className="landing-preview-block landing-preview-block--todo landing-preview-block--checked">
                <span className="landing-preview-checkbox landing-preview-checkbox--checked"/>Create your first workspace
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-features">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Everything you need, nothing you don't</h2>
          <div className="landing-features-grid">
            {features.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                {"docsHref" in f && (
                  <a href={(f as any).docsHref} className="landing-feature-link">
                    View API docs →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-pricing">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Simple pricing</h2>
          <p className="landing-section-sub">Host it yourself for free, or let us handle it when cloud launches.</p>
          <div className="landing-pricing-grid">
            {plans.map((plan) => (
              <div key={plan.name} className={`landing-plan ${plan.highlight ? "landing-plan--highlight" : ""}`}>
                <div className="landing-plan-name">{plan.name}</div>
                <div className="landing-plan-price">
                  {plan.price}
                  {plan.note && <span className="landing-plan-note"> / {plan.note}</span>}
                </div>
                <ul className="landing-plan-features">
                  {plan.features.map((f) => (
                    <li key={f}><span className="landing-plan-check">✓</span>{f}</li>
                  ))}
                </ul>
                {plan.ctaExternal ? (
                  <a href={plan.ctaHref} target="_blank" rel="noopener noreferrer"
                     className={plan.highlight ? "landing-cta-primary" : "landing-cta-secondary"}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link to={plan.ctaHref as any}
                        className={plan.highlight ? "landing-cta-primary" : "landing-cta-secondary"}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span>© 2025 Notara. MIT licensed.</span>
          <div className="landing-footer-links">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/api/docs">API docs</a>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
