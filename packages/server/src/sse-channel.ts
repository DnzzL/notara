/**
 * One place that knows how to be a server-sent-event endpoint.
 *
 * Two streams — presence and view-config — each carried their own copy of the
 * same mechanics: query-parameter authorization (EventSource cannot set
 * headers), a permission check, an async stream over a subscriber set, a
 * keepalive interval, the SSE header block, and a cause handler. The
 * view-config module said so in its own opening comment: "pattern mirrors
 * presence".
 *
 * They had already drifted. The keepalive was 20 seconds in one and 30 in the
 * other, and the finalizer defect documented in a comment on the presence route
 * existed identically in both while being described in only one. That is what
 * two copies of a pattern do: they diverge in the details nobody re-reads.
 *
 * What stays behind this interface: framing, keepalive, finalization, CORS, the
 * order in which authorization runs, and turning a refusal into a response. A
 * topic supplies only what actually differs — how to authorize, what to send
 * first, and how to subscribe.
 */

import { Effect, Queue, Stream } from "effect";
import type * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { allowedOrigin } from "./middleware.js";

/** Any SSE payload. The tag becomes the event name in the wire frame. */
export type SseEvent = { readonly type: string };

/**
 * A refusal, in the terms a topic reasons about. The channel turns it into a
 * JSON response so no topic has to build one.
 */
export class SseRefusal {
	readonly _tag = "SseRefusal";
	constructor(
		readonly status: number,
		readonly message: string,
	) {}
}

export const refuse = (status: number, message: string) =>
	Effect.fail(new SseRefusal(status, message));

/**
 * Keepalive interval, one value for every topic.
 *
 * Twenty seconds rather than thirty: proxies commonly idle out a connection at
 * thirty, and the cost of the extra frame is a comment line on the wire.
 */
const KEEPALIVE_MS = 20_000;

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
	// Nginx buffers proxied responses by default, which holds events until the
	// buffer fills — for a stream that is indistinguishable from being broken.
	"X-Accel-Buffering": "no",
	"Access-Control-Allow-Origin": allowedOrigin,
	Vary: "Origin",
};

const jsonError = (status: number, message: string) =>
	HttpServerResponse.text(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});

export type SseTopic<A> = {
	/** Named in the failure log line, so an incident says which stream broke. */
	readonly name: string;
	/**
	 * Parse the request and prove the caller may listen. Runs before anything is
	 * subscribed or streamed, so a refusal costs nothing.
	 */
	readonly authorize: Effect.Effect<
		A,
		SseRefusal,
		HttpServerRequest.HttpServerRequest
	>;
	/** Optional first frame, so a new subscriber starts populated rather than empty. */
	readonly initial?: (context: A) => SseEvent | null;
	/** Attach a subscriber; return the function that detaches it. */
	readonly subscribe: (
		context: A,
		send: (event: SseEvent) => void,
	) => () => void;
};

/**
 * Build the handler for one SSE topic.
 *
 * KNOWN, and inherited rather than introduced: on Bun the stream finalizer does
 * not run when a client disconnects — neither the closed response nor a failed
 * keepalive write surfaces it. Topics that care about departures must have
 * another way of learning about them (presence uses an explicit leave endpoint
 * plus a TTL sweep). Fixing it once here is the point of having one channel;
 * it is not fixed yet.
 */
export const sseChannel = <A>(topic: SseTopic<A>) =>
	Effect.gen(function* () {
		const context = yield* Effect.result(topic.authorize);
		if (context._tag === "Failure") {
			return jsonError(context.failure.status, context.failure.message);
		}

		const encoder = new TextEncoder();
		const frame = (event: SseEvent) =>
			encoder.encode(
				`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
			);

		const stream = Stream.callback<Uint8Array>((queue) =>
			Effect.gen(function* () {
				const send = (event: SseEvent) =>
					Queue.offerUnsafe(queue, frame(event));

				const first = topic.initial?.(context.success);
				if (first) send(first);

				const unsubscribe = topic.subscribe(context.success, send);
				const keepAlive = setInterval(
					() => Queue.offerUnsafe(queue, encoder.encode(": ping\n\n")),
					KEEPALIVE_MS,
				);

				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						clearInterval(keepAlive);
						unsubscribe();
					}),
				);
			}),
		);

		return HttpServerResponse.stream(stream, { headers: SSE_HEADERS });
	}).pipe(
		Effect.catchCause((cause) =>
			Effect.andThen(
				Effect.logError(`${topic.name} stream failed`, cause),
				Effect.succeed(jsonError(500, "Server error")),
			),
		),
	);
