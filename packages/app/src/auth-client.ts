import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: typeof window !== "undefined" ? window.location.origin : "",
	// Declarative only: this adds the typed /sign-in/anonymous call and issues no
	// requests of its own. The landing page's demo button is the sole caller, and
	// the endpoint only exists when the server runs with DEMO_MODE.
	plugins: [anonymousClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
