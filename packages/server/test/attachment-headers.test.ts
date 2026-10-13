/**
 * How a stored attachment is served. An attachment is whatever a member
 * uploaded, served from the app's own origin: an HTML or script file served as
 * such would run with the session of whoever opens it. Only images and PDFs
 * are shown; everything else is a download, and nothing an attachment contains
 * may run in the app's origin.
 */
import { describe, expect, test } from "bun:test";
import { attachmentHeaders } from "../src/handlers/attachments.js";

describe("serving an attachment", () => {
	test("HTML, scripts and unknown files are downloads, never documents", () => {
		for (const name of [
			"x.html",
			"x.htm",
			"x.js",
			"x.mjs",
			"x.xml",
			"x.bin",
			"x",
		]) {
			const h = attachmentHeaders(name);
			expect(h["Content-Type"], name).toBe("application/octet-stream");
			expect(h["Content-Disposition"], name).toBe("attachment");
			expect(h["Content-Security-Policy"], name).toContain("sandbox");
		}
	});

	test("images are shown, and cannot run anything even when opened directly", () => {
		for (const [name, type] of [
			["x.png", "image/png"],
			["x.JPG", "image/jpeg"],
			["x.svg", "image/svg+xml"],
		]) {
			const h = attachmentHeaders(name);
			expect(h["Content-Type"], name).toBe(type);
			expect(h["Content-Disposition"], name).toBe("inline");
			expect(h["Content-Security-Policy"], name).toContain("sandbox");
		}
	});

	test("a PDF is shown inline", () => {
		const h = attachmentHeaders("x.pdf");
		expect(h["Content-Type"]).toBe("application/pdf");
		expect(h["Content-Disposition"]).toBe("inline");
	});

	test("the browser is never left to guess the type", () => {
		expect(attachmentHeaders("x.png")["X-Content-Type-Options"]).toBe(
			"nosniff",
		);
	});
});
