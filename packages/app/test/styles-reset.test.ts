/**
 * The CSS reset must actually parse.
 *
 * A star-slash inside a comment (it read `p-*` slash `m-*`) closed it early; the
 * rest of it glued itself to `@layer base { … }` as one invalid rule, and the
 * browser dropped the whole reset for months without a single error.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("@layer base reset is not swallowed by a stray comment end", () => {
	const css = readFileSync(
		new URL("../src/styles.css", import.meta.url),
		"utf8",
	).replace(/\/\*[\s\S]*?\*\//g, "");
	const at = css.indexOf("@layer base {");
	expect(at).toBeGreaterThan(-1);
	// Whatever precedes the reset must end a statement, not be leftover prose.
	const before = css.slice(0, at).trimEnd();
	expect(before.at(-1)).toMatch(/[;}]/);
});
