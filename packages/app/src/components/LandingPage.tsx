import { Link } from "@tanstack/react-router";
import { capture } from "../analytics.js";

// Polar checkout URL is injected at build time. Falls back to a benign anchor so
// the landing page still renders during early development.
const POLAR_CHECKOUT_URL =
  (import.meta as any).env?.VITE_POLAR_CHECKOUT_URL ?? "#pricing";

const onCheckoutClick = (location: "hero" | "pricing") => () => {
  capture("checkout_clicked", { location, plan: "self_host", price_eur: 29 });
};

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
    title: "You own it",
    desc: "All data lives in a single SQLite file on your server. The source ships with your license — modify, export, walk away. No vendor lock-in, ever.",
  },
  {
    icon: "⚑",
    title: "Work with your team",
    desc: "Invite teammates, see who's on the page, and edit alongside them without stepping on each other's work.",
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
    icon: "♻",
    title: "Trash & restore",
    desc: "Deleted a page, database or row by mistake? Everything goes to the trash first — restore it in a click, or let it purge automatically after your retention window.",
  },
  {
    icon: "⌁",
    title: "Open REST API",
    desc: "Full HTTP API with API key auth. Automate from scripts, CI pipelines, or any HTTP client. OpenAPI spec included.",
    docsHref: "/api/docs",
  },
  {
    icon: "⌨",
    title: "Command-line client",
    desc: "Drive Notara from your terminal with the scriptable `notara` CLI — create pages, edit databases, and pipe JSON straight into your tools.",
  },
];

const plans = [
  {
    name: "Notara Self-Host",
    price: "€29",
    note: "early-bird · one-time · first 500 buyers",
    highlight: true,
    features: [
      "Full source code, delivered via private GitHub repo",
      "Run on your own server, unlimited workspaces & members",
      "Commercial use included",
      "Lifetime updates",
      "Reply-to-a-human support",
    ],
    cta: "Buy & get the source",
    ctaHref: POLAR_CHECKOUT_URL,
    ctaExternal: true,
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
          <div className="landing-badge">Early-bird · First 500 buyers · €29 forever</div>
          <h1 className="landing-headline">
            The notes app<br />you actually own
          </h1>
          <p className="landing-sub">
            Notara is a self-hostable Notion alternative. Block editor, inline databases,
            team collaboration — all in a single file on your own server. Pay once, keep it forever.
          </p>
          <div className="landing-hero-ctas">
            <a
              href={POLAR_CHECKOUT_URL}
              className="landing-cta-primary"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onCheckoutClick("hero")}
            >
              Get Notara — €29 (early-bird)
            </a>
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

      {/* Why source-available (honest answer) */}
      <section id="why-source-available" className="landing-why">
        <div className="landing-section-inner landing-why-inner">
          <h2 className="landing-section-title">Why source-available, not free open-source?</h2>
          <p className="landing-why-body">
            Honest framing: this is a compromise. Pure open-source brings a flood of issues, support
            requests, and forks that a one-person project can't absorb without dying inside a year.
            Pure closed-source breaks the promise that your data and tools are yours. Source-available
            sits between the two — paying buyers get the full source, the right to read it, modify
            it for their own use, and walk away with their data any time. In exchange I get a small,
            sustainable customer base I can actually support over the long run, instead of an audience
            I can't serve. That trade is what keeps Notara alive past month six.
          </p>
          <p className="landing-why-signoff">
            — Thomas Legrand, sole developer ·{" "}
            <a href="https://thomas.legrand.sh" target="_blank" rel="noopener noreferrer">thomas.legrand.sh</a>
            {" · "}
            <a href="https://github.com/dnzzl" target="_blank" rel="noopener noreferrer">@dnzzl</a>
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-pricing">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">One price. Yours forever.</h2>
          <p className="landing-section-sub">€29 one-time for the first 500 buyers — about three months of Notion, then never again. Lifetime updates included.</p>
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
                  <a
                    href={plan.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onCheckoutClick("pricing")}
                    className={plan.highlight ? "landing-cta-primary" : "landing-cta-secondary"}
                  >
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
          <span>
            © 2026 Notara · built by{" "}
            <a href="https://thomas.legrand.sh" target="_blank" rel="noopener noreferrer">Thomas Legrand</a>
            {" · "}
            <a href="https://github.com/dnzzl" target="_blank" rel="noopener noreferrer">github.com/dnzzl</a>
          </span>
          <div className="landing-footer-links">
            <a href="/api/docs">API docs</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
