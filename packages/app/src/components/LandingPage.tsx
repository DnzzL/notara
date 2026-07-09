import { Link } from "@tanstack/react-router";
import { capture } from "../analytics.js";

// Public source-available repository. Notara is fair-source (FSL-1.1-ALv2):
// free to self-host, no purchase step.
const REPO_URL = "https://github.com/dnzzl/notara";

const onGetSourceClick = (location: "hero" | "pricing") => () => {
  capture("get_source_clicked", { location });
};

const features = [
  {
    title: "Block editor",
    desc: "Paragraphs, headings, todos, code, tables, toggles and more — everything you need to write clearly.",
  },
  {
    title: "Inline databases",
    desc: "Table and board views live right inside your pages. Filter, sort, relate — no extra app required.",
  },
  {
    title: "You own it",
    desc: "All data lives in a single SQLite file on your server. The source ships with your license — modify, export, walk away. No vendor lock-in, ever.",
  },
  {
    title: "Work with your team",
    desc: "Invite teammates, see who's on the page, and edit alongside them without stepping on each other's work.",
  },
  {
    title: "Import from Notion",
    desc: "Bring your existing notes and databases in one click. Export back out anytime.",
  },
  {
    title: "S3 backups",
    desc: "Optional encrypted backups to any S3-compatible bucket. Scheduled or manual.",
  },
  {
    title: "Trash & restore",
    desc: "Deleted something by mistake? Everything goes to the trash first — restore in a click, or let it purge after your retention window.",
  },
  {
    title: "Desktop app",
    desc: "Native Electron app for macOS. Lives in your dock, works offline, syncs to your server. Web client also included — pick the interface you prefer.",
  },
  {
    title: "Open REST API",
    desc: "Full HTTP API with API-key auth. Automate from scripts, CI, or any client. OpenAPI spec included.",
    docsHref: "/api/docs",
  },
  {
    title: "Command-line client",
    desc: "Drive Notara from your terminal with the scriptable notara CLI — pipe JSON straight into your tools.",
    code: "notara",
  },
];

const planFeatures = [
  "Full source · public GitHub repo",
  "Unlimited workspaces & members",
  "Commercial & internal use",
  "Modify and redistribute",
  "Apache-2.0 after 2 years",
];

export function LandingPage() {
  return (
    <div className="landing">
      <div className="lp-gridlines" aria-hidden="true" />

      {/* Nav */}
      <nav className="landing-nav">
        <div className="lp-wrap landing-nav-inner">
          <div className="landing-brand">
            <div className="auth-brand-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" fill="currentColor"/>
                <rect x="11" y="2" width="7" height="7" fill="#2B4DFF"/>
                <rect x="2" y="11" width="7" height="7" fill="currentColor"/>
                <rect x="11" y="11" width="7" height="7" fill="currentColor"/>
              </svg>
            </div>
            <span className="landing-brand-name">NOTARA</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#why" className="landing-nav-link">Why</a>
            <a href="#pricing" className="landing-nav-link">License</a>
            <Link to="/login" className="landing-nav-cta">Sign in →</Link>
            <a
              href={REPO_URL}
              className="landing-nav-buy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onGetSourceClick("hero")}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="landing-hero">
        <div className="lp-wrap">
          <div className="lp-hero-tag lp-reveal" style={{ animationDelay: ".05s" }}>
            <span className="sq" />
          <span className="lp-kicker">Fair-source · <b>Free to self-host</b> · <span className="lp-badge">FSL-1.1-ALv2</span></span>
          </div>
          <h1 className="landing-headline lp-reveal" style={{ animationDelay: ".12s" }}>
            The notes app<br />you <span className="out">actually</span> <span className="blue">own.</span>
          </h1>
          <div className="lp-hero-lower">
            <div className="lp-hero-text">
              <p className="lp-reveal" style={{ animationDelay: ".24s" }}>
                A Notion alternative you can touch. Desktop app, block editor,
                inline databases, real-time collaboration — all backed by a single SQLite
                file on your own server. Free to self-host. Keep the source. Walk away whenever you like.
              </p>
              <div className="landing-hero-ctas lp-reveal" style={{ animationDelay: ".34s" }}>
                <a
                  href={REPO_URL}
                  className="landing-cta-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onGetSourceClick("hero")}
                >
                  Get the source →
                </a>
                <a href="#features" className="landing-cta-secondary">See the app →</a>
              </div>
            </div>
            <div className="lp-hero-visual lp-reveal" style={{ animationDelay: ".24s" }}>
              <video
                src="/notara-hero.mp4"
                autoPlay
                loop
                muted
                playsInline
                poster="/notara-hero-poster.jpg"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Specs */}
      <section className="lp-specs">
        <div className="lp-wrap lp-specs-in">
          <div className="lp-spec"><div className="num">1<span className="u">×</span></div><div className="lbl">SQLite file · your data</div></div>
          <div className="lp-spec"><div className="num">0<span className="u">/mo</span></div><div className="lbl">Subscriptions, forever</div></div>
          <div className="lp-spec"><div className="num">∞</div><div className="lbl">Workspaces &amp; members</div></div>
          <div className="lp-spec"><div className="num">2<span className="u">yr</span></div><div className="lbl">Then Apache-2.0</div></div>
        </div>
      </section>

      {/* Object */}
      <section className="lp-object">
        <div className="lp-wrap lp-object-in">
          <div className="lp-object-txt">
            <span className="lp-kicker"><b>01</b> · The premise</span>
            <h2>One file. On your disk. No vendors in the middle.</h2>
            <p>
              Everything you write lives in a single SQLite file on a server you control. The source
              is public — read it, modify it, export your data, walk away. There is
              nothing to be locked into.
            </p>
          </div>
          <div className="lp-object-file">
            <div className="lp-file-top"><i /><i /><i /><span className="p">~/notara.sqlite</span></div>
            <div className="lp-file-body">
              <div className="lp-frow title"><span className="n">01</span><span>Getting started</span></div>
              <div className="lp-frow"><span className="n">02</span><span>Everything lives in one SQLite file.</span></div>
              <div className="lp-frow"><span className="n">03</span><span className="lp-chk on" /><span className="lp-done">Import your Notion export</span></div>
              <div className="lp-frow"><span className="n">04</span><span className="lp-chk" /><span>Create your first workspace</span></div>
              <div className="lp-frow"><span className="n">05</span><span className="lp-chk" /><span>Invite the team</span></div>
            </div>
            <div className="lp-file-foot"><span>1 file · 0 vendors</span><span>yours, on disk</span></div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="lp-strip">
        <div className="lp-strip-in">
          <span>FAIR-SOURCE<em>/</em>FREE TO SELF-HOST<em>/</em>SELF-HOSTED<em>/</em>NO SUBSCRIPTION<em>/</em>NO CLOUD LOCK-IN<em>/</em>OPEN REST API<em>/</em>CLI INCLUDED<em>/</em></span>
          <span aria-hidden="true">FAIR-SOURCE<em>/</em>FREE TO SELF-HOST<em>/</em>SELF-HOSTED<em>/</em>NO SUBSCRIPTION<em>/</em>NO CLOUD LOCK-IN<em>/</em>OPEN REST API<em>/</em>CLI INCLUDED<em>/</em></span>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="landing-features">
        <div className="lp-wrap">
          <div className="lp-feat-head">
            <h2 className="landing-section-title">Everything you need<br />Nothing you don't</h2>
            <span className="lp-kicker">Index · 01—10</span>
          </div>
          {features.map((f, i) => (
            <div key={f.title} className="lp-feat-row">
              <span className="idx"><b>{String(i + 1).padStart(2, "0")}</b></span>
              <h3>{f.title}</h3>
              <p>
                {f.code
                  ? <>Drive Notara from your terminal with the scriptable <code>{f.code}</code> CLI — pipe JSON straight into your tools.</>
                  : f.desc}
                {f.docsHref && <> <a href={f.docsHref}>View docs →</a></>}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* For developers */}
      <section className="landing-dev">
        <div className="lp-wrap landing-dev-in">
          <span className="lp-kicker"><b>02</b> · For developers & AI agents</span>
          <h2>Automate everything.<br />Your tools &mdash; your way.</h2>
          <div className="lp-dev-examples">
            <div className="lp-dev-ex">
              <div className="lp-dev-cmd">notara pages list --json | jq '.title'</div>
              <div className="lp-dev-desc">Pipe your entire wiki into any script or AI agent</div>
            </div>
            <div className="lp-dev-ex">
              <div className="lp-dev-cmd">curl -X POST $HOST/api/pages \<br />&nbsp;&nbsp;-H "X-Api-Key: $KEY" -d '{'{'}&quot;title&quot;:&quot;...&quot;{'}'}</div>
              <div className="lp-dev-desc">Create pages from CI/CD, bots, or agent workflows</div>
            </div>
            <div className="lp-dev-ex">
              <div className="lp-dev-cmd"><span className="lp-dev-openapi">openapi.yaml</span> &middot; 30+ endpoints</div>
              <div className="lp-dev-desc">Full REST API &mdash; read, write, search, manage. API-key auth.</div>
            </div>
            <div className="lp-dev-ex">
              <div className="lp-dev-cmd"><a href="https://jsr.io/@notara/cli" target="_blank" rel="noopener noreferrer" className="lp-dev-jsr">@notara/cli</a> on JSR</div>
              <div className="lp-dev-desc">Install via <code>npx jsr add @notara/cli</code> &mdash; pipe JSON, automate, script.</div>
            </div>
          </div>
          <a href="/api/docs" className="landing-dev-link">Browse the API docs →</a>
        </div>
      </section>

      {/* Why source-available */}
      <section id="why" className="landing-why">
        <div className="lp-wrap lp-why-in">
          <span className="lp-kicker"><b>03</b> · A note from the developer</span>
          <h2>Why fair-source, not just MIT?</h2>
          <p className="landing-why-body">
            Honest framing: Notara is free to self-host, and the source is public. The one thing the
            licence forbids is someone taking it, wrapping it in a hosted service, and reselling it as a
            competitor — that's the only way a one-person project gets strip-mined. Everything else is
            fair game: run it, modify it, redistribute it, use it commercially, export your data and
            walk away any time. And it isn't a forever-catch: every release turns into plain Apache-2.0
            two years after it ships. Open by default, with just enough protection to stay alive.
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
        <div className="lp-wrap">
          <div className="lp-price-head">
            <span className="lp-kicker"><b>04</b> · Free &amp; fair-source</span>
            <h2>No tiers.<br />No price.</h2>
            <p className="sub">Notara is free to self-host under the FSL-1.1-ALv2 licence — clone it, run it, own it. Every release becomes Apache-2.0 two years after it ships.</p>
          </div>
          <div className="lp-sheet">
            <div className="lp-sheet-left">
              <span className="tag">Notara · self-host</span>
              <h3>What you get</h3>
              {planFeatures.map((f) => (
                <div key={f} className="lp-sline">{f}<span className="c">INCL</span></div>
              ))}
            </div>
            <div className="lp-sheet-right">
              <span className="badge">Fair-source · FSL-1.1-ALv2</span>
              <div className="amt">€0</div>
              <div className="once">free · self-hosted</div>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onGetSourceClick("pricing")}
                className="buy"
              >
                Clone &amp; self-host →
              </a>
              <div className="fine">FSL-1.1-ALv2 · PUBLIC REPO · APACHE-2.0 IN 2 YEARS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="lp-wrap landing-footer-inner">
          <span>
            © 2026 Notara · built by{" "}
            <a href="https://thomas.legrand.sh" target="_blank" rel="noopener noreferrer">Thomas Legrand</a>
          </span>
          <div className="landing-footer-links">
            <a href="/api/docs">API</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
