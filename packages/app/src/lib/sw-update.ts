/**
 * Service worker registration, and — the part that was missing — actually
 * taking the update.
 *
 * vite-plugin-pwa's injected `registerSW.js` is one line: register `/sw.js` on
 * load, and nothing else. With `registerType: "autoUpdate"` the new worker does
 * `skipWaiting()` + `clientsClaim()`, so it *takes control* of the open page —
 * but the page has already rendered the old precached HTML and the old bundle.
 * Nothing reloads it. And nothing ever calls `update()` again, so a standalone
 * PWA window that is never closed checks for a new build exactly once, at the
 * moment it was first opened.
 *
 * The result in production: a deploy lands, and installed clients keep serving
 * the previous build indefinitely.
 *
 * So: check on every foreground, and reload once the new worker has taken over.
 */

/** Belt to the visibility check's braces, for a window left open for days. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) return;

	// On a first install there is no controller, `controllerchange` fires as the
	// new worker claims the page, and reloading there would bounce every first
	// visit. Only an *update* replaces an existing controller.
	const hadController = Boolean(navigator.serviceWorker.controller);
	let reloading = false;

	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (!hadController || reloading) return;
		reloading = true;
		window.location.reload();
	});

	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("/sw.js", { scope: "/" })
			.then((registration) => {
				setInterval(() => registration.update(), UPDATE_INTERVAL_MS);
				document.addEventListener("visibilitychange", () => {
					if (document.visibilityState === "visible") registration.update();
				});
			})
			.catch(() => {
				// A worker that fails to register is not worth a toast: the app works
				// without it, it just loses offline support until the next load.
			});
	});
}
