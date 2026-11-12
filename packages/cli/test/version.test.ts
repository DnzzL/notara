import { expect, test } from "bun:test";
import jsr from "../jsr.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

test("--version prints package.json's version", async () => {
	const proc = Bun.spawn(["bun", "src/main.ts", "--version"], {
		cwd: `${import.meta.dir}/..`,
		stdout: "pipe",
	});
	const out = await new Response(proc.stdout).text();
	expect(await proc.exited).toBe(0);
	expect(out).toContain(pkg.version);
});

test("jsr.json version matches package.json", () => {
	expect(jsr.version).toBe(pkg.version);
});
