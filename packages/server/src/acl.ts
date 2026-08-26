/**
 * The relation model, declared rather than walked.
 *
 * Notara's access control is Zanzibar-shaped: relation tuples of
 * `(resource, relation, subject)`, subjects that may be a user, a userset
 * (`workspace:<id>#member`) or `public`, and per-resource revisions usable as
 * zookies. What lived in a hand-rolled loop until now was the *resolution* —
 * which relation a caller ends up holding on a page — and that is what this
 * module makes explicit.
 *
 * ── Where this departs from the paper, and why ──────────────────────────────
 *
 * Zanzibar composes relations from usersets with union, intersection and
 * exclusion. Every one of those is monotonic: adding a tuple can only ever
 * grant more. Notara's page hierarchy is not monotonic. Placing any grant on a
 * page makes that page authoritative for its whole subtree, so a grant on a
 * child *removes* access that would otherwise be inherited from the parent.
 * That is the "lock this page" feature: dropping a single tuple privatises a
 * page without naming the twenty people being excluded.
 *
 * The canonical Zanzibar alternative is union inheritance plus an explicit
 * `blocked` relation subtracted from it. It keeps the capability but makes
 * exclusion nominative, which does not scale to "make this private", and would
 * require migrating stored tuples and reworking the sharing UI. Plain union
 * inheritance was rejected outright: it silently widens access on existing
 * installs and removes subtree restriction altogether.
 *
 * So the departure is deliberate and confined to one rule. It is made legible
 * by the `Decision` type below: a rule may grant, may *deny authoritatively*,
 * or may abstain. A monotonic model has no `deny` — its rules only ever grant
 * or abstain. Having the third case in the type is what stops this from being
 * a while-loop with a comment.
 */
import { SqlClient } from "@effect/sql";
import { Effect } from "effect";

export type Relation = "owner" | "editor" | "viewer";

/**
 * Relation implications, declared once.
 *
 * Holding a relation implies holding every weaker one. This replaces the
 * numeric rank ladder: ranks answer "which is bigger", which is only
 * accidentally the same question as "does this satisfy that".
 */
const IMPLIES: Record<Relation, readonly Relation[]> = {
	owner: ["owner", "editor", "viewer"],
	editor: ["editor", "viewer"],
	viewer: ["viewer"],
};

/** Does holding `held` satisfy a requirement for `required`? */
export const implies = (held: Relation, required: Relation): boolean =>
	IMPLIES[held].includes(required);

/** The strongest of a set of held relations, or null if there are none. */
export const strongest = (relations: readonly Relation[]): Relation | null =>
	relations.reduce<Relation | null>(
		(best, r) => (best === null || implies(r, best) ? r : best),
		null,
	);

/**
 * What one rule concluded.
 *
 * `deny` is authoritative and stops evaluation — that is the non-monotonic part
 * described above. `abstain` means "no opinion, ask the next rule".
 */
export type Decision =
	| { readonly _tag: "grant"; readonly relation: Relation }
	| { readonly _tag: "deny" }
	| { readonly _tag: "abstain" };

export const grant = (relation: Relation): Decision => ({
	_tag: "grant",
	relation,
});
export const deny: Decision = { _tag: "deny" };
export const abstain: Decision = { _tag: "abstain" };

/** The caller, and the workspace the question is being asked in. */
export type Principal = {
	readonly userId: string;
	readonly workspaceId: string;
	/** Null when the caller is not a member of the workspace at all. */
	readonly workspaceRole: "owner" | "member" | null;
};

/**
 * Subjects that match this principal, in the canonical wire format enforced by
 * the `acl_tuples` CHECK constraint.
 */
export const subjectsOf = (principal: Principal): readonly string[] => [
	`user:${principal.userId}`,
	`workspace:${principal.workspaceId}#member`,
	"public",
];

type Rule = (
	principal: Principal,
	pageId: string,
) => Effect.Effect<Decision, never, SqlClient.SqlClient>;

/** A workspace owner holds `owner` on everything in it, ACLs notwithstanding. */
const workspaceOwnerRules: Rule = (principal) =>
	Effect.succeed(
		principal.workspaceRole === "owner" ? grant("owner") : abstain,
	);

/**
 * The nearest ancestor bearing any tuple answers for the whole subtree.
 *
 * Walk up from the page. The first resource carrying tuples — itself included —
 * is authoritative: the caller holds the strongest relation among the tuples
 * addressed to them there, and if none is, the answer is `deny`, not `abstain`.
 * Returning `deny` rather than falling through is the whole of the lock
 * behaviour, and the whole of the departure from the paper.
 */
const nearestBearerDecides: Rule = (principal, pageId) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const subjects = subjectsOf(principal);

		let current: string | null = pageId;
		while (current !== null) {
			const tuples = (yield* sql
				.unsafe(
					"SELECT relation, subject FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?",
					[current],
				)
				.pipe(Effect.orDie)) as unknown as ReadonlyArray<{
				relation: string;
				subject: string;
			}>;

			if (tuples.length > 0) {
				const held = tuples
					.filter((t) => subjects.includes(t.subject))
					.map((t) => t.relation as Relation);
				const best = strongest(held);
				return best === null ? deny : grant(best);
			}

			const parents = (yield* sql
				.unsafe("SELECT parent_id FROM pages WHERE id = ?", [current])
				.pipe(Effect.orDie)) as unknown as ReadonlyArray<{
				parent_id: string | null;
			}>;
			current = parents.length > 0 ? (parents[0].parent_id ?? null) : null;
		}

		return abstain;
	});

/** With no lock anywhere above it, a plain member may edit. */
const workspaceMemberRules: Rule = (principal) =>
	Effect.succeed(
		principal.workspaceRole === "member" ? grant("editor") : abstain,
	);

/**
 * The page namespace, in precedence order. First rule to reach a verdict wins;
 * unanimous abstention is a refusal.
 */
const PAGE_RULES: readonly Rule[] = [
	workspaceOwnerRules,
	nearestBearerDecides,
	workspaceMemberRules,
];

/**
 * The relation this principal effectively holds on this page, or null when
 * they hold none.
 */
export const effectiveRelation = (
	principal: Principal,
	pageId: string,
): Effect.Effect<Relation | null, never, SqlClient.SqlClient> =>
	Effect.gen(function* () {
		if (principal.workspaceRole === null) return null;

		for (const rule of PAGE_RULES) {
			const decision = yield* rule(principal, pageId);
			if (decision._tag === "grant") return decision.relation;
			if (decision._tag === "deny") return null;
		}
		return null;
	});
