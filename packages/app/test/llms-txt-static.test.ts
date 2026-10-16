/**
 * `/llms.txt` on a deployment (NOT-182). The production edge sends `/api/*` to
 * the server and every other path to the static app container, so the API route
 * that serves this document is never reached for `/llms.txt` — the file itself
 * must ship in the app build. `public/` is copied into `dist/` verbatim, so a
 * file there is the deployed artifact.
 *
 * The text has one source of truth: `llmsTxt` in the server. The copy below is
 * generated from it (`bun run --filter @notara/app generate:llms-txt`), and this
 * test fails the moment the two drift.
 */
import { describe, expect, test } from "bun:test";
import { llmsTxt } from "../../server/src/api-v1/llms.js";

const staticFile = Bun.file(new URL("../public/llms.txt", import.meta.url));

describe("llms.txt ships with the app", () => {
	test("is in the app build input", async () => {
		expect(await staticFile.exists()).toBe(true);
	});

	test("is byte-identical to the server's llmsTxt", async () => {
		expect(await staticFile.text()).toBe(llmsTxt);
	});
});

describe("nginx serves it as markdown", () => {
	test("declares text/markdown for /llms.txt", async () => {
		const nginx = await Bun.file(
			new URL("../nginx.conf", import.meta.url),
		).text();
		expect(nginx).toMatch(/location = \/llms\.txt/);
		expect(nginx).toMatch(/text\/markdown/);
	});

	test("no longer answers a missing file-like path with the SPA shell", async () => {
		// `try_files $uri $uri/ /index.html` in `location /` is what returned a
		// 200 index.html for `/llms.txt` before the file existed. Extensionless
		// paths stay the app's client-side routes; a path that names a file and
		// matches nothing on disk must 404.
		const nginx = await Bun.file(
			new URL("../nginx.conf", import.meta.url),
		).text();
		expect(nginx).not.toMatch(/try_files \$uri \$uri\/ \/index\.html/);
		expect(nginx).toMatch(/@spa/);
	});
});
