/**
 * Safe API call wrapper for Zustand stores.
 *
 * Catches RPC errors and surfaces them via toasts so unhandled promise
 * rejections don't silently swallow failures in production.
 */
import { AccessDeniedError } from "../rpc-client.js";
import { toaster } from "../toaster.js";

/** Wrap an async action with error handling + toast notification. */
export async function safeAction<T>(
	label: string,
	fn: () => Promise<T>,
	onError?: (e: unknown) => void,
): Promise<T | undefined> {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof AccessDeniedError) {
			toaster.create({
				type: "error",
				title: label,
				description: "You don't have permission to perform this action.",
			});
		} else {
			toaster.create({
				type: "error",
				title: label,
				description: String(e),
			});
		}
		onError?.(e);
		return undefined;
	}
}
