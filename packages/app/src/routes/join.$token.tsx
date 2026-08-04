import { createRoute, redirect } from "@tanstack/react-router";
import { createAuthClient } from "better-auth/react";
import { api } from "../rpc-client.js";
import { toaster } from "../toaster.js";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/join/$token",
	beforeLoad: async ({ params }) => {
		const client = createAuthClient({ baseURL: window.location.origin });
		const session = await client.getSession();
		if (!session?.data) {
			throw redirect({ to: "/login" });
		}
		// Only the RPC call is guarded. The success redirect used to be thrown
		// inside the try, where its own catch swallowed it and downgraded it to
		// the /workspaces fallback — so invitees who *had* joined landed on the
		// workspace picker with no explanation.
		let workspace: Awaited<ReturnType<typeof api.joinWorkspaceByToken>>;
		try {
			workspace = await api.joinWorkspaceByToken({ inviteToken: params.token });
		} catch {
			// Deliberately not surfacing the server's message: joinWorkspaceByToken
			// fails with a plain Error, which the RPC boundary flattens to `{}` —
			// the toast would read "{}". An invalid token is the only failure mode.
			toaster.create({
				title: "Invalid invite link",
				description:
					"This invite link is not valid, or it has been replaced by a newer one.",
				type: "error",
			});
			throw redirect({ to: "/workspaces" });
		}

		throw redirect({
			to: "/$workspaceSlug",
			params: { workspaceSlug: workspace.slug },
		});
	},
	component: () => <p>Joining workspace...</p>,
});
