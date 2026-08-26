/**
 * Authorization as composable values.
 *
 * A policy is an Effect that succeeds when access is granted and fails with
 * `AuthError` when it is not. Because it is an ordinary Effect, policies
 * compose with `all` and `any` and attach to any operation with `withPolicy`,
 * instead of each call site re-assembling the same sequence of checks by hand.
 *
 * Adapted from Lucas Barake's composable policy system, trimmed to what this
 * codebase needs. Two things are deliberately NOT taken from it:
 *
 *   - The `domain:action` permission union and its `makePermissions` helper.
 *     Notara already has a relation vocabulary (`owner` / `editor` / `viewer`)
 *     with an ordering, stored as tuples. A second permission language would
 *     recreate exactly the duplication this module exists to remove.
 *
 *   - `HttpApiMiddleware.Tag`, which belongs to `@effect/platform`'s HttpApi.
 *     This server runs on `@effect/rpc` plus a hand-rolled router, so
 *     `CurrentUser` is supplied by a Layer built from the request instead.
 *
 * ORDERING: attach the guard LAST in a pipe. Effect evaluates `zipRight`'s left
 * side first, so a guard written last runs first — failing before the operation
 * does any work, and before the workspace layer is opened.
 *
 *     doTheThing.pipe(withPolicy(Workspace.member(workspaceId)))
 *
 * TESTABILITY is the point. `CurrentUser` is a Tag, so a test provides a
 * principal as a layer and asserts on authorization without booting a server or
 * minting a cookie — which, before this module, was the only way to assert
 * anything about auth at all.
 */
import { AuthError } from "@notara/shared";
import { Context, Effect } from "effect";

/**
 * The authenticated caller.
 *
 * Deliberately thin: an id and the email the admin gate compares against.
 * Everything else about what this caller may do is a question for a policy,
 * answered against stored relations rather than carried on the principal.
 */
export class CurrentUser extends Context.Tag("CurrentUser")<
	CurrentUser,
	{ readonly userId: string; readonly email: string }
>() {}

/**
 * A decision. Succeeds with void when access is granted, fails with `AuthError`
 * when refused. `E` and `R` carry whatever the decision itself needs — a
 * database, usually.
 */
export type Policy<E = never, R = never> = Effect.Effect<
	void,
	AuthError | E,
	CurrentUser | R
>;

/** 403 with a stated reason. The one place a refusal is constructed. */
export const forbidden = (message: string) =>
	new AuthError({ status: 403, message });

/** 401. The caller is not authenticated at all. */
export const unauthorized = (message = "Unauthorized") =>
	new AuthError({ status: 401, message });

/**
 * Build a policy from a predicate over the current user.
 *
 * `reason` is the refusal message. Make it specific: it reaches the user, and a
 * generic "Forbidden" is the difference between a support ticket and a
 * self-service fix.
 */
export const policy = <E, R>(
	reason: string,
	predicate: (user: CurrentUser["Type"]) => Effect.Effect<boolean, E, R>,
): Policy<E, R> =>
	Effect.flatMap(CurrentUser, (user) =>
		Effect.flatMap(predicate(user), (granted) =>
			granted ? Effect.void : Effect.fail(forbidden(reason)),
		),
	);

/**
 * Lift an Effect that already fails with `AuthError` into a policy — for checks
 * that carry their own refusal reasons rather than answering yes or no.
 */
export const fromCheck = <E, R>(
	check: (user: CurrentUser["Type"]) => Effect.Effect<void, AuthError | E, R>,
): Policy<E, R> => Effect.flatMap(CurrentUser, check);

/** Attach a policy to an operation. Write it last in the pipe; see ORDERING. */
export const withPolicy =
	<E, R>(p: Policy<E, R>) =>
	<A, E2, R2>(self: Effect.Effect<A, E2, R2>) =>
		Effect.zipRight(p, self);

/**
 * Every policy must pass. Sequential rather than concurrent: the checks hit
 * SQLite in-process, and running them in order means the cheapest stated first
 * decides, without opening connections the answer did not need.
 */
export const all = <E, R>(
	...policies: readonly [Policy<E, R>, ...Array<Policy<E, R>>]
): Policy<E, R> =>
	Effect.all(policies, { concurrency: 1, discard: true }) as Policy<E, R>;

/**
 * Any policy passing is enough. The LAST refusal is what the caller sees, so
 * order alternatives with the most informative reason last.
 */
export const any = <E, R>(
	...policies: readonly [Policy<E, R>, ...Array<Policy<E, R>>]
): Policy<E, R> => Effect.firstSuccessOf(policies) as Policy<E, R>;
