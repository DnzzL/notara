/**
 * The design system, as a test rather than a paragraph.
 *
 * docs/design-system.md used to be the only statement of these rules, and a
 * document cannot fail: it claimed for months that the sidebar's selected node
 * was `--accent-dim` with a blue left bar when the code used a taupe fill, and
 * Notion's cyan (#2eaadc) lived on in `rgba(46,170,220,…)` form long after the
 * hex literals were removed. Nothing noticed, because nothing was looking.
 *
 * This test looks. Every off-system colour or radius in the app sources has to
 * be listed in ALLOWED below with a reason someone can argue with; anything
 * else fails the build. The allowlist is the point — it turns "we have a design
 * system" into "here are the places we knowingly step outside it".
 *
 * It scans styles.css too. It did not at first, and the doc still claimed it
 * "enforces the colour and radius rules" — so an indigo `var(--accent, #4a6cf7)`
 * fallback and two hardcoded reds sat in the largest colour surface in the app,
 * certified by a guard that never read the file.
 *
 * What it checks in CSS is narrower than in components, on purpose. Opaque
 * colours are policed, because that is the failure mode that actually happened:
 * a brand colour from somewhere else, hardcoded. Alpha ramps are not — a
 * `rgba(255,255,255,0.12)` hover on the dark bubble menu is a shade of a
 * surface, not a colour decision, and a token per step would be ceremony.
 * If an alpha of a colour that HAS a token shows up, that is a review catch,
 * not a test one.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dir, "..", "src");

/** An off-system literal we accept, and why. Keep the reason honest. */
type Exemption = { file: string; literal: string; why: string };

const ALLOWED: Exemption[] = [
	// ── Brand marks. These are other companies' colours; a token would be a lie.
	{
		file: "routes/login.tsx",
		literal: "#4285F4|#34A853|#FBBC05|#EA4335",
		why: "Google's brand colours in the inline OAuth logo",
	},
	// ── Fixed option palette. A user picks these per select option; they are
	//    data, not chrome, and must stay stable across any theme change.
	{
		file: "components/db/CellComponents.tsx",
		literal:
			"#e3e2e0|#e9d5ca|#fad4c0|#fdecc8|#dcf4d4|#d3e5ef|#dadfee|#f5d6e8|#ffe2dd|#1e1e1e|#A1663B|#C9A227|#2B7FB8|#5B5BD6|#C2408A",
		why: "The select-option colour palette — user data, deliberately theme-independent",
	},
	// ── Inline SVG illustrations. Multi-stop artwork, not interface surfaces.
	{
		file: "components/BlockEditor.tsx",
		literal: "SVG",
		why: "Empty-state and file-type illustrations drawn inline",
	},
	{
		file: "components/ApiKeysPanel.tsx",
		literal: "SVG",
		why: "Key/lock illustration drawn inline",
	},
	{
		file: "components/LandingPage.tsx",
		literal: "SVG",
		why: "Marketing artwork on the landing page, not an interface surface",
	},
	{
		file: "styles.css",
		literal: "#8FA2FF",
		why: "The accent lightened to stay legible on the landing's ink price panel",
	},
	{
		file: "styles.css",
		literal: "#888",
		why: "Mid grey on the dark bubble menu, where the ink ramp is unreadable",
	},
];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
/** Pure black and pure white are surfaces, not brand colours. */
const NEUTRAL = /^#(?:fff(?:fff)?|000(?:000)?)$/i;
const RGB = /rgba?\([^)]*\)/g;
const ARBITRARY_RADIUS = /rounded-\[(?!var\()([^\]]+)\]/g;
const TAILWIND_PALETTE =
	/\b(?:text|bg|border|from|to|via)-(?:red|blue|green|yellow|amber|orange|purple|pink|indigo|teal|cyan|slate|gray|grey|zinc|neutral|stone|lime|emerald|sky|violet|fuchsia|rose)-\d{2,3}\b|\b(?:text|bg|border)-black(?:\/[\d[\].]+)?\b/g;

function sources(): { path: string; rel: string; text: string }[] {
	const out: { path: string; rel: string; text: string }[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) {
				walk(path);
				continue;
			}
			if (!/\.(tsx?|css)$/.test(entry)) continue;
			out.push({
				path,
				rel: relative(SRC, path),
				text: readFileSync(path, "utf8"),
			});
		}
	};
	walk(SRC);
	return out;
}

/** `:root` and `@theme` are where the tokens are *defined*; they may hold hex. */
function withoutTokenDefinitions(text: string): string {
	return text
		.replace(/@theme[^{]*\{[\s\S]*?\n\}/g, "")
		.replace(/:root\s*\{[\s\S]*?\n\}/g, "");
}

const FILES = sources();

/** Exemptions that cover a whole file (inline artwork) or specific literals. */
function isAllowed(rel: string, literal: string): boolean {
	return ALLOWED.some(
		(a) =>
			a.file === rel &&
			(a.literal === "SVG" || a.literal.split("|").includes(literal)),
	);
}

function offenders(pattern: RegExp, normalise = (s: string) => s) {
	const found: string[] = [];
	for (const { rel, text } of FILES) {
		const body = rel.endsWith(".css") ? withoutTokenDefinitions(text) : text;
		for (const match of body.match(pattern) ?? []) {
			const literal = normalise(match);
			if (isAllowed(rel, literal)) continue;
			// CSS: opaque colours only. See the note at the top of this file.
			if (rel.endsWith(".css")) {
				if (literal.startsWith("rgba")) continue;
				if (NEUTRAL.test(literal)) continue;
			}
			found.push(`${rel}: ${literal}`);
		}
	}
	return [...new Set(found)].sort();
}

describe("colour", () => {
	test("no hex literal outside the allowlist", () => {
		expect(offenders(HEX)).toEqual([]);
	});

	test("no rgb()/rgba() literal outside the allowlist", () => {
		// `rgba(var(--x) / .5)` is token-based and fine.
		const found = offenders(RGB, (s) => s.replace(/\s+/g, "")).filter(
			(f) => !f.includes("var("),
		);
		expect(found).toEqual([]);
	});

	test("no raw Tailwind palette colours", () => {
		expect(offenders(TAILWIND_PALETTE)).toEqual([]);
	});
});

describe("radius", () => {
	test("no arbitrary rounded-[Npx]; use rounded-sm | rounded | rounded-lg", () => {
		expect(offenders(ARBITRARY_RADIUS)).toEqual([]);
	});
});

describe("stylesheet structure", () => {
	// biome does not lint CSS (files.includes is .ts/.tsx only), so an unbalanced
	// brace is silent: it nests every following rule inside the previous block or
	// closes a media query early, and the styles simply stop applying. That is
	// how a toolbar rule ended up inside a `@media (max-width: 880px)` and did
	// nothing on desktop, with no error anywhere.
	test("braces balance in every stylesheet", () => {
		const unbalanced = FILES.filter((f) => f.rel.endsWith(".css")).map((f) => {
			let depth = 0;
			for (const ch of f.text) {
				if (ch === "{") depth++;
				else if (ch === "}") depth--;
			}
			return { file: f.rel, depth };
		});
		expect(unbalanced.filter((u) => u.depth !== 0)).toEqual([]);
	});
});

describe("the allowlist itself", () => {
	test("every exemption still points at a file that exists", () => {
		const known = new Set(FILES.map((f) => f.rel));
		expect(
			ALLOWED.filter((a) => !known.has(a.file)).map((a) => a.file),
		).toEqual([]);
	});

	test("every exemption carries a reason", () => {
		expect(ALLOWED.filter((a) => a.why.trim().length < 20)).toEqual([]);
	});
});
