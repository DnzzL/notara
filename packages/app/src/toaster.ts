import { createToaster } from "@ark-ui/react/toast";

/**
 * The type is annotated rather than inferred.
 *
 * Inferring it names `ToastStore` from a path inside `.bun/`, which TypeScript
 * refuses to emit as portable — invisible under the app's tsconfig and an error
 * under the test project, which type-checks this file through its importers.
 */
export const toaster: ReturnType<typeof createToaster> = createToaster({
	placement: "bottom-end",
	gap: 10,
	max: 5,
});
