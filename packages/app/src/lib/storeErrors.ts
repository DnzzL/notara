/**
 * What a store does when an API call fails.
 *
 * `databaseStore` did nothing at all: nineteen actions called the API bare, so a
 * rejected promise changed nothing on screen and said nothing to the user. A
 * rename that failed simply did not happen, and there was no way to tell that
 * from a rename that had not been attempted.
 *
 * Nineteen copies of try/catch would have closed that. Two helpers state the
 * policy once instead, and each call site declares which one it wants — the
 * choice between "the caller needs to know" and "report and carry on" is a real
 * decision, and naming it makes it reviewable.
 *
 * `blockStore` and `apiKeyStore` still carry their own private `showError`,
 * identical to the one here. They predate this module and are not migrated in
 * the same change; doing so is a tidy-up, not a fix.
 */
import { AccessDeniedError } from "../rpc-client.js";
import { toaster } from "../toaster.js";

/**
 * Surface a failure to the user.
 *
 * Access denials are the exception: the component layer renders those, because
 * it knows what the user was trying to reach and can offer something better
 * than a toast.
 */
export function showError(title: string, e: unknown) {
	if (e instanceof AccessDeniedError) return;
	toaster.create({ type: "error", title, description: String(e) });
}

/**
 * Report a failure and rethrow.
 *
 * For calls whose result the caller uses, or whose failure the caller must see
 * in order to roll back an optimistic update.
 */
export async function guarded<T>(
	title: string,
	run: () => Promise<T>,
): Promise<T> {
	try {
		return await run();
	} catch (e) {
		showError(title, e);
		throw e;
	}
}

/**
 * Report a failure and carry on, leaving state as it was.
 *
 * For loads: a failed refresh should surface an error rather than blank the
 * view, and rethrowing would reject into a caller that has no way to react.
 */
export async function reported(title: string, run: () => Promise<unknown>) {
	try {
		await run();
	} catch (e) {
		showError(title, e);
	}
}
