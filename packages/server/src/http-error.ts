/**
 * One place that turns a failed request into a JSON response.
 *
 * Typed API failures (`@notara/shared` errors) keep their own status and are not
 * reported as incidents — a 404 is an answer, not a bug. Anything else is an
 * unexpected failure: 500, generic body, reported to PostHog.
 */
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { type ApiError, isApiError } from "@notara/shared";
import { corsHeaders } from "./middleware.js";
import { reportError } from "./observability.js";

const JSON_HEADERS = { "Content-Type": "application/json", ...corsHeaders };

const statusOf = (error: ApiError): number => {
	switch (error._tag) {
		case "AuthError":
			return error.status;
		case "NotFoundError":
			return 404;
		case "ConflictError":
		case "BlockLockedError":
			return 409;
		case "ValidationError":
			return 400;
	}
};

export const jsonError = (status: number, message: string) =>
	HttpServerResponse.text(JSON.stringify({ error: message }), {
		status,
		headers: JSON_HEADERS,
	});

/** Response for the error of a `Fail` cause. */
export const failureResponse = (error: unknown) => {
	if (isApiError(error)) return jsonError(statusOf(error), error.message);
	reportError(error);
	return jsonError(500, String(error));
};
