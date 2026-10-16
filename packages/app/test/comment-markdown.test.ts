/**
 * A comment is a markdown note (CONTEXT.md): what the agent marks up shows
 * formatted, and nothing it writes runs as HTML.
 */
import { describe, expect, test } from "bun:test";
import { commentHtml } from "../src/lib/commentHtml.js";

describe("commentHtml", () => {
	test("bold, italic, code and links show formatted", () => {
		expect(
			commentHtml("**Done**, see `api.ts` and _the_ [spec](https://x.test/a)."),
		).toBe(
			'<strong>Done</strong>, see <code>api.ts</code> and <em>the</em> <a target="_blank" rel="noopener noreferrer" href="https://x.test/a">spec</a>.',
		);
	});

	test("a fenced block is code, its markup left alone", () => {
		expect(commentHtml("Diff:\n```ts\nconst a = **b**;\n```\nok")).toBe(
			"Diff:\n<pre><code>const a = **b**;\n</code></pre>ok",
		);
	});

	test("HTML in a comment is text", () => {
		expect(commentHtml("<img src=x onerror=alert(1)> & co")).toBe(
			"&lt;img src=x onerror=alert(1)&gt; &amp; co",
		);
	});

	test("a link to anything but http(s) stays text", () => {
		expect(commentHtml("[click](javascript:alert(1))")).not.toContain("<a");
	});

	test("a heading is a heading, one to three", () => {
		expect(commentHtml("# One\n## Two\n### Three")).toBe(
			"<h1>One</h1><h2>Two</h2><h3>Three</h3>",
		);
	});

	test("bullets are one list", () => {
		expect(commentHtml("- one\n- two")).toBe(
			"<ul><li>one</li><li>two</li></ul>",
		);
	});

	test("a todo is a checkbox, its tick kept", () => {
		expect(commentHtml("- [ ] todo\n- [x] done")).toBe(
			'<ul class="comment-todos"><li><input type="checkbox" disabled> todo</li><li><input type="checkbox" disabled checked> done</li></ul>',
		);
	});

	test("a quoted line is a quote, its lines together", () => {
		expect(commentHtml("> quoted\n> more")).toBe(
			"<blockquote>quoted\nmore</blockquote>",
		);
	});

	test("a marker inside a fence stays code", () => {
		expect(commentHtml("```\n# not a heading\n- not a list\n```")).toBe(
			"<pre><code># not a heading\n- not a list\n</code></pre>",
		);
	});

	test("an unclosed fence stays code, and does not throw", () => {
		expect(commentHtml("```\nstill code")).toBe(
			"<pre><code>still code</code></pre>",
		);
	});

	test("a link in a bullet still opens off the page", () => {
		expect(commentHtml("- see [spec](https://x.test/a)")).toBe(
			'<ul><li>see <a target="_blank" rel="noopener noreferrer" href="https://x.test/a">spec</a></li></ul>',
		);
	});

	test("a script, an onerror image and an iframe are escaped text, in a block too", () => {
		const cases: ReadonlyArray<readonly [string, string]> = [
			[
				'<script>alert("x")</script>',
				'&lt;script&gt;alert("x")&lt;/script&gt;',
			],
			[
				'<img src=x onerror="alert(1)">',
				'&lt;img src=x onerror="alert(1)"&gt;',
			],
			[
				'<iframe src="https://evil.test"></iframe>',
				'&lt;iframe src="https://evil.test"&gt;&lt;/iframe&gt;',
			],
			[
				"# <script>alert(1)</script>",
				"<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>",
			],
			[
				"> <img src=x onerror=alert(1)>",
				"<blockquote>&lt;img src=x onerror=alert(1)&gt;</blockquote>",
			],
			[
				"- [x] <iframe src=x></iframe>",
				'<ul class="comment-todos"><li><input type="checkbox" disabled checked> &lt;iframe src=x&gt;&lt;/iframe&gt;</li></ul>',
			],
		];
		for (const [body, expected] of cases)
			expect(commentHtml(body)).toBe(expected);
	});

	test("no comment markup becomes a live tag", () => {
		for (const body of [
			'<script>alert("x")</script>',
			'<img src=x onerror="alert(1)">',
			"<iframe src=https://evil.test></iframe>",
		])
			expect(commentHtml(body)).not.toMatch(/<(script|img|iframe)/i);
	});

	test("what is outside the subset shows as written, not lost", () => {
		expect(commentHtml("| a | b |\n| - | - |")).toBe("| a | b |\n| - | - |");
		expect(commentHtml("![a cat](cat.png)")).toBe("![a cat](cat.png)");
		expect(commentHtml("1. one")).toBe("1. one");
	});

	test("newlines and blank lines are kept", () => {
		expect(commentHtml("one\ntwo\n\nthree")).toBe("one\ntwo\n\nthree");
		expect(commentHtml("  spaced  ")).toBe("  spaced  ");
	});

	test("prose around a list keeps its own lines", () => {
		expect(commentHtml("Steps:\n- one\n- two\nDone.")).toBe(
			"Steps:<ul><li>one</li><li>two</li></ul>Done.",
		);
	});
});
