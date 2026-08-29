/**
 * What an incident report carries.
 *
 * Eight call sites in the server entry point reported failures as
 * `reportError(new Error(cause.toString()))`. That threw away everything worth
 * having: the original error's type and stack, and the Cause's structure — was
 * it a defect, a failure, an interruption, two failures in parallel? What
 * arrived in PostHog was a synthetic Error whose stack pointed at the line that
 * built it.
 */
import { describe, expect, test } from "bun:test";
import { Cause } from "effect";
import { causeToReport } from "../src/observability.js";

describe("causeToReport", () => {
	test("a defect is reported as the thing that was actually thrown", () => {
		const thrown = new TypeError("cannot read x of undefined");
		const { error } = causeToReport(Cause.die(thrown));
		// Identity, not a copy: the stack has to survive.
		expect(error).toBe(thrown);
	});

	test("a typed failure is reported as itself", () => {
		const failure = { _tag: "AuthError", status: 403 };
		const { error } = causeToReport(Cause.fail(failure));
		expect(error).toBe(failure);
	});

	test("the pretty-printed cause travels as context", () => {
		// The squashed error alone loses whether this was a defect or a failure,
		// and loses the second branch of a parallel cause entirely.
		const { context } = causeToReport(Cause.die(new Error("boom")));
		expect(context.cause).toContain("boom");
	});

	test("both reasons of a combined cause survive in the context", () => {
		const both = Cause.combine(
			Cause.die(new Error("first")),
			Cause.die(new Error("second")),
		);
		const { context } = causeToReport(both);
		expect(context.cause).toContain("first");
		expect(context.cause).toContain("second");
	});

	test("an interruption is labelled, and does not crash the reporter", () => {
		// A cancelled request is not an incident; reporting it as one is noise.
		// It also cannot be squashed — doing so throws, which would take down the
		// error reporter on the one path least able to afford it.
		const { context, error } = causeToReport(Cause.interrupt(1));
		expect(context.interrupted).toBe(true);
		expect(error).toBeInstanceOf(Error);
	});

	test("a non-interrupt cause is not labelled interrupted", () => {
		const { context } = causeToReport(Cause.die(new Error("boom")));
		expect(context.interrupted).toBe(false);
	});
});
