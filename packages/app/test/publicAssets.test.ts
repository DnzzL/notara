/**
 * The one string transform between a shared page's stored content and what a
 * stranger's browser asks for.
 *
 * Get it wrong in one direction and every image on a public page is a broken
 * icon; get it wrong in the other and the rewrite mangles URLs that had nothing
 * to do with attachments.
 */
import { describe, expect, test } from "bun:test";
import {
	publicAttachmentUrl,
	rewriteAttachmentUrls,
} from "../src/lib/publicAssets.js";

const TOKEN = "abc123";

describe("rewriteAttachmentUrls", () => {
	test("repoints an inline image in a text block", () => {
		// A paragraph can carry an <img> just as an image block carries a JSON
		// src, so the pass runs over whole HTML rather than a parsed field.
		expect(
			rewriteAttachmentUrls('<p><img src="/attachments/01H.png"></p>', TOKEN),
		).toBe('<p><img src="/api/public/pages/abc123/attachments/01H.png"></p>');
	});

	test("repoints a JSON src in an image block", () => {
		expect(rewriteAttachmentUrls('{"src":"/attachments/01H.png"}', TOKEN)).toBe(
			'{"src":"/api/public/pages/abc123/attachments/01H.png"}',
		);
	});

	test("repoints every occurrence, not just the first", () => {
		const out = rewriteAttachmentUrls(
			'<img src="/attachments/a.png"><img src="/attachments/b.png">',
			TOKEN,
		);
		expect(out).not.toContain('"/attachments/');
		expect(out).toContain("abc123/attachments/a.png");
		expect(out).toContain("abc123/attachments/b.png");
	});

	test("leaves unrelated URLs alone", () => {
		const html =
			'<p><a href="https://example.com/attachments-policy">terms</a></p>';
		expect(rewriteAttachmentUrls(html, TOKEN)).toBe(html);
	});

	test("is idempotent — a rewritten URL is not rewritten again", () => {
		// The renderer may run over the same content on a re-render; a second
		// pass that nested the prefix would 404 everything.
		const once = rewriteAttachmentUrls('<img src="/attachments/a.png">', TOKEN);
		expect(rewriteAttachmentUrls(once, TOKEN)).toBe(once);
	});

	test("leaves content with no attachments untouched", () => {
		expect(rewriteAttachmentUrls("<p>Just words</p>", TOKEN)).toBe(
			"<p>Just words</p>",
		);
	});
});

describe("publicAttachmentUrl", () => {
	test("escapes a token so it cannot break out of the path", () => {
		expect(publicAttachmentUrl("a/../b", "x.png")).toBe(
			"/api/public/pages/a%2F..%2Fb/attachments/x.png",
		);
	});
});
