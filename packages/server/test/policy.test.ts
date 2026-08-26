/**
 * The point of this file is that it exists.
 *
 * Before the Policy module there was no way to assert anything about
 * authorization without booting a server on a port and minting a real cookie —
 * which is why `api-v1/routes.ts` had no tests at all and why NOT-102 shipped.
 * Here a principal is provided as a layer and the decision is a value.
 */
import { describe, expect, test } from "bun:test";
import { AuthError } from "@notara/shared";
import { Effect, Exit, Layer } from "effect";
import {
	all,
	any,
	CurrentUser,
	forbidden,
	fromCheck,
	policy,
	withPolicy,
} from "../src/policy.js";

const asUser = (userId = "u1", email = "u1@example.test") =>
	Effect.provide(Layer.succeed(CurrentUser, { userId, email }));

/** Run a policy-guarded effect and report what happened. */
const run = <A, E>(effect: Effect.Effect<A, E, CurrentUser>) =>
	Effect.runPromise(Effect.exit(effect.pipe(asUser())));

const granted = policy("never seen", () => Effect.succeed(true));
const refused = (reason: string) => policy(reason, () => Effect.succeed(false));

describe("policy", () => {
	test("a satisfied policy lets the operation run", async () => {
		const exit = await run(Effect.succeed("done").pipe(withPolicy(granted)));
		expect(exit).toEqual(Exit.succeed("done"));
	});

	test("a refused policy fails with 403 and its stated reason", async () => {
		const exit = await run(
			Effect.succeed("done").pipe(withPolicy(refused("not a member"))),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		const error = Exit.isFailure(exit)
			? (exit.cause as unknown as { error: AuthError }).error
			: null;
		expect(error).toBeInstanceOf(AuthError);
		expect(error?.status).toBe(403);
		expect(error?.message).toBe("not a member");
	});

	test("the guard runs before the operation, not after it", async () => {
		// The reason to write the guard last in the pipe: zipRight evaluates its
		// left side first, so nothing expensive or destructive happens on a
		// request that was never allowed.
		let ran = false;
		const exit = await run(
			Effect.sync(() => {
				ran = true;
				return "done";
			}).pipe(withPolicy(refused("denied"))),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		expect(ran).toBe(false);
	});

	test("the predicate sees the current user", async () => {
		const onlyU2 = policy("wrong user", (user) =>
			Effect.succeed(user.userId === "u2"),
		);
		const exit = await Effect.runPromise(
			Effect.exit(
				Effect.succeed("done").pipe(withPolicy(onlyU2), asUser("u2")),
			),
		);
		expect(exit).toEqual(Exit.succeed("done"));
	});

	test("fromCheck carries its own refusal through unchanged", async () => {
		const check = fromCheck(() => Effect.fail(forbidden("locked ancestor")));
		const exit = await run(Effect.succeed("done").pipe(withPolicy(check)));
		const error = Exit.isFailure(exit)
			? (exit.cause as unknown as { error: AuthError }).error
			: null;
		expect(error?.message).toBe("locked ancestor");
	});
});

describe("all", () => {
	test("passes only when every policy passes", async () => {
		const exit = await run(
			Effect.succeed("done").pipe(withPolicy(all(granted, granted))),
		);
		expect(exit).toEqual(Exit.succeed("done"));
	});

	test("fails on the first refusal", async () => {
		const exit = await run(
			Effect.succeed("done").pipe(
				withPolicy(all(refused("first"), refused("second"))),
			),
		);
		const error = Exit.isFailure(exit)
			? (exit.cause as unknown as { error: AuthError }).error
			: null;
		expect(error?.message).toBe("first");
	});

	test("stops evaluating after a refusal", async () => {
		let evaluated = 0;
		const counting = policy("counted", () =>
			Effect.sync(() => {
				evaluated += 1;
				return false;
			}),
		);
		await run(Effect.succeed("done").pipe(withPolicy(all(counting, counting))));
		expect(evaluated).toBe(1);
	});
});

describe("any", () => {
	test("passes when one alternative passes", async () => {
		const exit = await run(
			Effect.succeed("done").pipe(
				withPolicy(any(refused("no relation"), granted)),
			),
		);
		expect(exit).toEqual(Exit.succeed("done"));
	});

	test("fails when every alternative refuses, reporting the last reason", async () => {
		// Documented ordering: put the most informative reason last, because that
		// is the one the caller is told.
		const exit = await run(
			Effect.succeed("done").pipe(
				withPolicy(any(refused("not the owner"), refused("no page grant"))),
			),
		);
		const error = Exit.isFailure(exit)
			? (exit.cause as unknown as { error: AuthError }).error
			: null;
		expect(error?.message).toBe("no page grant");
	});
});
