import { expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };

test("--version prints package.json's version", async () => {
	const proc = Bun.spawn(["bun", "src/main.ts", "--version"], {
		cwd: `${import.meta.dir}/..`,
		stdout: "pipe",
	});
	const out = await new Response(proc.stdout).text();
	expect(out).toContain(pkg.version);
});
