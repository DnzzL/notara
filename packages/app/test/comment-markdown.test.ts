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
});
