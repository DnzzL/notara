/**
 * The API error contract.
 *
 * These are the only failures that cross the RPC boundary as *typed* errors:
 * every `Rpc.make` in `api.ts` declares `error: ApiError`, so the client
 * receives them decoded and can discriminate on `_tag` instead of matching
 * strings in a serialized cause. Anything else a handler can fail with
 * (SQL errors, bugs, missing headers) stays a defect on purpose — see
 * `dieUnlessApiError` in the server's rpc-handlers.
 *
 * They are `Schema.TaggedError` classes so the same class is used to fail on
 * the server, to encode on the wire, and to test with on the client.
 */
import { Schema } from "effect";

/** What kind of thing was missing. Keeps NotFoundError messages uniform. */
export const NotFoundResource = Schema.Literal(
	"page",
	"block",
	"database",
	"record",
	"field",
	"view",
	"workspace",
	"template",
);
export type NotFoundResource = typeof NotFoundResource.Type;

/** Not signed in (401) or signed in without access to the target (403). */
export class AuthError extends Schema.TaggedError<AuthError>()("AuthError", {
	status: Schema.Literal(401, 403),
	message: Schema.String,
}) {}

/** The addressed resource does not exist, or is in the trash. */
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
	"NotFoundError",
	{
		resource: NotFoundResource,
		id: Schema.String,
	},
) {
	override get message(): string {
		return `${this.resource} ${this.id} not found`;
	}
}

/** The request is well-formed but conflicts with the current state. */
export class ConflictError extends Schema.TaggedError<ConflictError>()(
	"ConflictError",
	{ message: Schema.String },
) {}

/** The request itself is unusable: bad payload, unknown token, disabled mode. */
export class ValidationError extends Schema.TaggedError<ValidationError>()(
	"ValidationError",
	{ message: Schema.String },
) {}

/** Another user holds the editing lock on this block right now. */
export class BlockLockedError extends Schema.TaggedError<BlockLockedError>()(
	"BlockLockedError",
	{ holderUserId: Schema.String },
) {
	override get message(): string {
		return "Another user is editing this block";
	}
}

/** Every typed failure the API can return. Declared on all RPC methods. */
export const ApiError = Schema.Union(
	AuthError,
	NotFoundError,
	ConflictError,
	ValidationError,
	BlockLockedError,
);
export type ApiError = typeof ApiError.Type;

/** True for the failures that are part of the contract above. */
export const isApiError: (u: unknown) => u is ApiError = Schema.is(ApiError);

/**
 * The serialized `Cause` shape the RPC transport puts on the wire, so a client
 * can decode a failure back into the classes above instead of reading fields
 * out of the JSON by hand.
 */
export const ApiCause = Schema.Cause({
	error: ApiError,
	defect: Schema.Unknown,
});
