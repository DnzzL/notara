/**
 * Boot the real server for a test file, on a port the OS says is free, and
 * guarantee it dies with the file: afterAll, and SIGINT/SIGTERM (Ctrl-C, timeout)
 * which skip afterAll. A hard crash is not
 * covered (bun test skips `exit`). Fixed ports leaked servers that broke the
 * next run and collided across parallel worktrees.
 */

import { afterAll } from "bun:test";
import { join } from "node:path";

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

const live = new Set<Bun.Subprocess>();
const killAll = () => {
	for (const p of live) p.kill();
};
for (const sig of ["SIGINT", "SIGTERM"] as const)
	process.on(sig, () => {
		killAll();
		process.exit(1);
	});

// Ask the OS, then release: the server rebinds it a few ms later. The window is
// tiny, and the retry-free alternative (port 0 in the server) needs src changes.
export const freePort = () => {
	const probe = Bun.serve({ port: 0, fetch: () => new Response() });
	const port = probe.port as number;
	probe.stop(true);
	return port;
};

/** `port`: pass one back to restart a server on the same address. `env` gets the base URL so each file can wire BETTER_AUTH_URL / BASE_URL its own way. */
export async function bootServer(
	env: (base: string) => Record<string, string>,
	port = freePort(),
) {
	const base = `http://localhost:${port}`;
	const proc = Bun.spawn(["bun", ENTRY], {
		env: { ...process.env, PORT: String(port), ...env(base) },
		stdout: "pipe",
		stderr: "pipe",
	});
	live.add(proc);
	afterAll(() => proc.kill());

	for (let i = 0; i < 300; i++) {
		try {
			if ((await fetch(`${base}/health`)).ok) return { proc, base };
		} catch {}
		await Bun.sleep(100);
	}
	// Surface the server's own output; an opaque timeout is undebuggable in CI.
	const stderr = await new Response(proc.stderr as ReadableStream).text();
	proc.kill();
	throw new Error(`server did not come up in 30s:\n${stderr}`);
}
