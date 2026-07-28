/**
 * Store re-exports — each slice is independently testable.
 *
 * Prefer individual store hooks with selectors for granular subscriptions.
 * Cross-domain orchestration lives in lib/page-loader.js.
 *
 * DANGER: use selector-based subscriptions (usePageStore(s => s.pages)) rather
 * than destructuring the full store, or you'll re-render on every unrelated change.
 */

export { useApiKeyStore } from "./stores/apiKeyStore.js";
export { useBlockStore } from "./stores/blockStore.js";
export { useDatabaseStore } from "./stores/databaseStore.js";
export { usePageStore } from "./stores/pageStore.js";
