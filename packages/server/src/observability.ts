import { Cause, HashMap, Layer, List, Logger, LogLevel } from "effect";
import { PostHog } from "posthog-node";

const posthogKey = process.env.POSTHOG_KEY?.trim();
const posthogHost =
	process.env.POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";
const enabled = !!posthogKey;

const posthog: PostHog | null = enabled
	? new PostHog(posthogKey!, {
			host: posthogHost,
			// Server-side: flush on a short cadence so errors don't sit in a buffer.
			flushAt: 1,
			flushInterval: 1_000,
		})
	: null;

if (enabled) {
	console.log(
		`[observability] PostHog enabled (host=${posthogHost}, env=${process.env.NODE_ENV ?? "production"})`,
	);
	const shutdown = async () => {
		try {
			await posthog?.shutdown();
		} catch {
			// best-effort; we're going down anyway.
		}
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
	process.on("beforeExit", shutdown);
}

/**
 * Turn an Effect `Cause` into something worth reporting.
 *
 * Call sites used to do `reportError(new Error(cause.toString()))`, which threw
 * away everything: the original error's type and stack, and the Cause's
 * structure — defect or failure, one branch or two. What reached PostHog was a
 * synthetic Error whose stack pointed at the line that built it.
 *
 * `squash` recovers the thing actually thrown, so its stack survives. The
 * pretty-printed cause rides along as context, because squashing loses the
 * shape: a parallel failure keeps only one of its branches.
 */
export function causeToReport(cause: Cause.Cause<unknown>): {
	error: unknown;
	context: { cause: string; interrupted: boolean };
} {
	// Interruption first: squashing an interrupt-only cause throws, so reporting
	// a cancelled request would crash the error reporter itself.
	const interrupted = Cause.hasInterruptsOnly(cause);
	return {
		error: interrupted ? new Error("Interrupted") : Cause.squash(cause),
		context: {
			cause: Cause.pretty(cause),
			// A cancelled request is not an incident. Labelled rather than
			// suppressed, so the noise is filterable instead of invisible.
			interrupted,
		},
	};
}

/** Report a Cause with its structure intact. Prefer this over reportError. */
export function reportCause(cause: Cause.Cause<unknown>): void {
	const { error, context } = causeToReport(cause);
	reportError(error, context);
}

/** Report an error to PostHog if configured; always logs to stderr. */
export function reportError(
	err: unknown,
	context?: Record<string, unknown>,
): void {
	if (posthog) {
		try {
			// captureException attaches the error as an exception event; "system"
			// is used as the distinct_id when no user context is available.
			posthog.captureException(
				err instanceof Error ? err : new Error(String(err)),
				"system",
				context,
			);
		} catch (captureErr) {
			console.error(
				"[observability] posthog.captureException failed",
				captureErr,
			);
		}
	}
	console.error("[error]", err, context ?? "");
}

export const observabilityEnabled = enabled;

/**
 * Track a product analytics event. Fire-and-forget; no PII should be passed
 * in `properties` (use `distinctId` for user reference).
 *
 * Use sparingly — every event here should answer a decision question. Today:
 *   - signup_completed       → top-of-funnel
 *   - workspace_created      → account-to-workspace conversion
 *   - page_created           → real activation
 *   - get_source_clicked     → self-host intent (front-end only)
 */
export function track(
	event: string,
	distinctId: string,
	properties?: Record<string, unknown>,
): void {
	if (!posthog) return;
	try {
		posthog.capture({ distinctId, event, properties });
	} catch (err) {
		console.error("[observability] track failed", { event, err });
	}
}

/**
 * Production logger: one JSON object per log line, easy to grep/ship.
 * Development: the pretty default. Selected from NODE_ENV.
 */
const jsonLogger = Logger.make(
	({ logLevel, message, date, spans, annotations }) => {
		const spanList = List.toArray(spans);
		const annoEntries = HashMap.toEntries(annotations);
		const payload: Record<string, unknown> = {
			ts: date.toISOString(),
			level: logLevel.label,
			msg: Array.isArray(message)
				? message.map(String).join(" ")
				: String(message),
		};
		if (spanList.length > 0) payload.spans = spanList.map((s) => s.label);
		if (annoEntries.length > 0) {
			payload.annotations = Object.fromEntries(
				annoEntries.map(([k, v]) => [k, String(v)]),
			);
		}
		// eslint-disable-next-line no-console
		console.log(JSON.stringify(payload));
	},
);

const isProd = (process.env.NODE_ENV ?? "production") === "production";

const levelFromEnv = (fallback: "Info" | "Debug") => {
	const raw = process.env.LOG_LEVEL;
	switch (raw) {
		case "All":
		case "Trace":
		case "Debug":
		case "Info":
		case "Warning":
		case "Error":
		case "Fatal":
		case "None":
			return LogLevel.fromLiteral(raw);
		default:
			return LogLevel.fromLiteral(fallback);
	}
};

export const LoggerLive = isProd
	? Layer.mergeAll(
			Logger.replace(Logger.defaultLogger, jsonLogger),
			Logger.minimumLogLevel(levelFromEnv("Info")),
		)
	: Logger.minimumLogLevel(levelFromEnv("Debug"));
