/**
 * Artifacts (NOT-162, ADR-013): a self-contained HTML document attached to a
 * page and shown live in it — scripts run, nothing leaves.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { blockToMarkdown } from "../src/export/page.js";
import {
	attachmentHeaders,
	withBaseTarget,
} from "../src/handlers/attachments.js";
import * as Blocks from "../src/handlers/blocks.js";
import * as Pages from "../src/handlers/pages.js";
import { uploadFile } from "../src/handlers/upload.js";
import { restWorkspace } from "./rest-harness.js";

let dataDir: string;
const before = process.env.DATA_DIR;
beforeEach(() => {
	dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-artifacts-"));
	process.env.DATA_DIR = dataDir;
});
afterEach(() => {
	process.env.DATA_DIR = before;
	fs.rmSync(dataDir, { recursive: true, force: true });
});

const REPORT = `<!doctype html><html><head>
<script src="https://cdn.example.com/chart.js"></script>
<link rel="stylesheet" href="https://fonts.example.org/f.css">
</head><body><a href="https://docs.example.net/more">more</a>
<script>document.body.append("hi")</script></body></html>`;

const upload = (
	api: ReturnType<typeof restWorkspace>,
	pageId: string,
	fileName: string,
	html: string,
) =>
	api.run(
		uploadFile({
			pageId,
			fileName,
			mimeType: "text/html",
			fileBuffer: Buffer.from(html),
		}),
	);

describe("attaching an artifact", () => {
	test("an HTML file becomes an artifact block, its external hosts reported", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const res = await upload(api, page.id, "report.html", REPORT);
		expect(res.blockedHosts).toEqual(["cdn.example.com", "fonts.example.org"]);
		const [block] = await api.run(Blocks.listBlocks(page.id));
		expect(block.type).toBe("artifact");
		expect(JSON.parse(block.content)).toMatchObject({
			fileName: "report.html",
			blockedHosts: ["cdn.example.com", "fonts.example.org"],
		});
	});

	test("attaching it again replaces it: same block, new content, no history", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const first = await upload(api, page.id, "report.html", REPORT);
		const second = await upload(api, page.id, "report.html", "<p>v2</p>");
		expect(second.blockId).toBe(first.blockId);
		expect(second.fileUrl).toBe(first.fileUrl);
		expect(second.blockedHosts).toEqual([]);
		const blocks = await api.run(Blocks.listBlocks(page.id));
		expect(blocks).toHaveLength(1);
		const files = fs.readdirSync(path.join(dataDir, "attachments"));
		expect(files).toHaveLength(1);
		expect(
			fs.readFileSync(path.join(dataDir, "attachments", files[0]), "utf-8"),
		).toBe("<p>v2</p>");
	});

	test("an artifact over 5 MB is refused", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const big = `<p>${"x".repeat(5 * 1024 * 1024)}</p>`;
		await expect(upload(api, page.id, "big.html", big)).rejects.toThrow(/5 MB/);
		expect(await api.run(Blocks.listBlocks(page.id))).toEqual([]);
	});
});

describe("serving an artifact", () => {
	test("runs its own scripts, in an opaque origin, with no network", () => {
		const h = attachmentHeaders("01X.html", { artifact: true });
		expect(h["Content-Type"]).toBe("text/html; charset=utf-8");
		const csp = h["Content-Security-Policy"];
		expect(csp).toContain("sandbox allow-scripts allow-popups");
		expect(csp).not.toContain("allow-same-origin");
		expect(csp).toContain("default-src 'none'");
		expect(csp).toContain("script-src 'unsafe-inline'");
		expect(csp).not.toMatch(/https?:/);
		expect(h["Cache-Control"]).toBe("no-store");
	});

	test("an HTML file uploaded as a plain file stays a download", () => {
		const h = attachmentHeaders("01X.html", { artifact: false });
		expect(h["Content-Type"]).toBe("application/octet-stream");
		expect(h["Content-Disposition"]).toBe("attachment");
	});

	test("its links open in a new tab", () => {
		expect(withBaseTarget("<!doctype html><html><head><title>t</title>")).toBe(
			'<!doctype html><html><head><base target="_blank"><title>t</title>',
		);
		expect(withBaseTarget("<!DOCTYPE html>\n<p>x</p>")).toBe(
			'<!DOCTYPE html>\n<base target="_blank"><p>x</p>',
		);
		expect(withBaseTarget("<p>x</p>")).toBe('<base target="_blank"><p>x</p>');
	});
});

test("in markdown, an artifact is a link", () => {
	expect(
		blockToMarkdown(
			"artifact",
			JSON.stringify({ src: "/attachments/01X.html", fileName: "report.html" }),
		),
	).toBe("[Artifact: report.html](/attachments/01X.html)");
});
