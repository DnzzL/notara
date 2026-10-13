/**
 * Artifacts (NOT-162, ADR-013): a self-contained HTML document attached to a
 * page and shown live in it — scripts run, nothing leaves.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { blockToMarkdown } from "../src/export/page.js";
import {
	attachmentHeaders,
	withBaseTarget,
} from "../src/handlers/attachments.js";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import * as Permissions from "../src/handlers/permissions.js";
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

describe("artifacts over REST", () => {
	const W = "/api/v1/workspaces/ws";

	test("a key attaches a report to a page, then regenerates it in place", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const posted = await api.call(
			"POST",
			`${W}/pages/${page.id}/artifacts?name=report.html`,
			{ key: "write", raw: REPORT },
		);
		expect(posted.status).toBe(201);
		expect(posted.json).toMatchObject({
			blockedHosts: ["cdn.example.com", "fonts.example.org"],
		});
		expect(posted.json.url).toBe(`/attachments/${posted.json.id}.html`);

		const put = await api.call("PUT", `${W}/artifacts/${posted.json.id}`, {
			key: "write",
			raw: "<p>v2</p>",
		});
		expect(put.status).toBe(200);
		expect(put.json).toEqual({
			id: posted.json.id,
			url: posted.json.url,
			blockedHosts: [],
		});
		const blocks = await api.run(Blocks.listBlocks(page.id));
		expect(blocks.map((b) => b.type)).toEqual(["artifact"]);
	});

	test("a card nobody opened takes an artifact by its short id", async () => {
		using api = restWorkspace();
		const { db } = await api.run(
			Effect.gen(function* () {
				const page = yield* Pages.createPage({ title: "P", parentId: null });
				const db = yield* Databases.createDatabase({
					pageId: page.id,
					name: "Notara",
				});
				yield* Databases.createRecord({ databaseId: db.id, title: "t" });
				return { db };
			}),
		);
		const res = await api.call(
			"POST",
			`${W}/databases/${db.id}/records/NOT-1/artifacts?name=diff.html`,
			{ key: "write", raw: "<p>diff</p>" },
		);
		expect(res.status).toBe(201);
		const card = await api.call(
			"GET",
			`${W}/databases/${db.id}/records/NOT-1`,
			{
				key: "read",
			},
		);
		expect(card.json.body).toBe(`[Artifact: diff.html](${res.json.url})`);
	});

	test("a read key, a missing name, a non-HTML name or over 5 MB is refused", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const url = `${W}/pages/${page.id}/artifacts`;
		const statuses = [
			(
				await api.call("POST", `${url}?name=r.html`, {
					key: "read",
					raw: "<p/>",
				})
			).status,
			(await api.call("POST", url, { key: "write", raw: "<p/>" })).status,
			(await api.call("POST", `${url}?name=r.js`, { key: "write", raw: "x" }))
				.status,
			(
				await api.call("POST", `${url}?name=r.html`, {
					key: "write",
					raw: "x".repeat(5 * 1024 * 1024 + 1),
				})
			).status,
		];
		expect(statuses).toEqual([403, 422, 422, 422]);
	});

	test("an artifact on a page locked away from the caller cannot be replaced", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const posted = await api.call(
			"POST",
			`${W}/pages/${page.id}/artifacts?name=r.html`,
			{ key: "write", raw: "<p/>" },
		);
		await api.run(
			Permissions.writePagePermissions({
				pageId: page.id,
				set: [{ subject: { type: "user", id: "ann" }, relation: "owner" }],
				remove: [],
			}),
		);
		const res = await api.call("PUT", `${W}/artifacts/${posted.json.id}`, {
			key: "bob",
			raw: "<p>owned</p>",
		});
		expect(res.status).toBe(403);
	});
});
