import * as HttpServerResponse from "@effect/platform/HttpServerResponse";

// ── CORS / Security ───────────────────────────────────────────────────────────

const _allowedOrigin = (() => {
	const base = process.env.BASE_URL?.trim();
	if (base) return base;
	const trusted = (process.env.TRUSTED_ORIGINS ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return trusted.length > 0 ? trusted[0] : "*";
})();

export const securityHeaders: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "SAMEORIGIN",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"X-XSS-Protection": "0",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=()",
	"Content-Security-Policy":
		"default-src 'self'; script-src 'self' https://eu.i.posthog.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://eu.i.posthog.com wss:; img-src 'self' data: blob:; font-src 'self'; frame-ancestors 'self'; form-action 'self'",
};

export const corsHeaders: Record<string, string> = {
	"Access-Control-Allow-Origin": _allowedOrigin,
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
	Vary: "Origin",
	...securityHeaders,
};

// ── Rate Limiter ──────────────────────────────────────────────────────────────
//
// In-memory, per-process. Deliberately mono-instance — Notara ships as a
// single-instance self-host product (see docs/adr/002). If you horizontally
// scale this behind a load balancer the counters won't be shared and the
// limits will be effectively N× looser. For multi-instance, terminate
// rate-limiting at nginx or a Redis-backed limiter.

const RATE_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function setInterval_unref(fn: () => void, ms: number) {
	const t = setInterval(fn, ms);
	if (typeof t === "object" && "unref" in t) (t as NodeJS.Timeout).unref();
}

// Clean expired entries every 60s
setInterval_unref(() => {
	const now = Date.now();
	for (const [k, v] of rateLimits) if (v.resetAt < now) rateLimits.delete(k);
}, 60_000);

function checkRateLimit(key: string, limit: number): boolean {
	const now = Date.now();
	let entry = rateLimits.get(key);
	if (!entry || entry.resetAt < now) {
		entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
		rateLimits.set(key, entry);
	}
	entry.count++;
	return entry.count <= limit;
}

function getIp(
	req: import("@effect/platform/HttpServerRequest").HttpServerRequest,
): string {
	const h = req.headers;
	return (
		(h["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
		(h["x-real-ip"] as string) ??
		"unknown"
	);
}

export const tooManyRequests = (retryAfter: number) =>
	HttpServerResponse.text("Too Many Requests", {
		status: 429,
		headers: { "Retry-After": String(retryAfter), ...corsHeaders },
	});

// Re-export checkRateLimit and getIp for inline use in auth handler
export { checkRateLimit, getIp };
