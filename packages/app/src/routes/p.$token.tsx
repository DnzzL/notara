/**
 * A shared page, open to anyone with the link.
 *
 * Deliberately no `beforeLoad`: every other route in the app gates on a
 * session, and the whole point of this one is that a reader has none. Opening
 * it in a private window must show the page, not a login form — which is what
 * e2e/rest-public-share.spec.ts holds in place.
 *
 * The fetch goes through restCall rather than the RPC client. The RPC client
 * carries a workspace id and a session; a public reader has neither, and
 * importing it here would pull the store in behind it.
 */
import { createRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	type PublicPageData,
	ReadOnlyPage,
} from "../components/ReadOnlyPage.js";
import { restCall } from "../lib/restClient.js";
import { Route as rootRoute } from "./__root.js";

type State =
	| { status: "loading" }
	| { status: "ready"; data: PublicPageData }
	| { status: "gone" };

function PublicPageRoute() {
	const { token } = Route.useParams();
	const [state, setState] = useState<State>({ status: "loading" });

	useEffect(() => {
		let cancelled = false;
		restCall<PublicPageData>(`/api/public/pages/${encodeURIComponent(token)}`)
			.then((data) => {
				if (!cancelled) setState({ status: "ready", data });
			})
			// The server answers every no with the same 404 — revoked, never
			// existed, in the bin, or locked since. So does this: the reader is
			// told the link does not work, never why, because why is not theirs
			// to know.
			.catch(() => {
				if (!cancelled) setState({ status: "gone" });
			});
		return () => {
			cancelled = true;
		};
	}, [token]);

	if (state.status === "loading")
		return <p className="text-center text-text-3 text-sm py-24">Loading…</p>;

	if (state.status === "gone")
		return (
			<div className="max-w-[520px] mx-auto px-6 py-24 text-center">
				<h1 className="[font-family:var(--font-title)] text-[24px] font-bold text-text mb-2.5">
					This page isn't available
				</h1>
				<p className="text-[14px] text-text-2 leading-relaxed">
					The link may have been turned off, or the page may have been deleted.
					Ask whoever shared it for a new one.
				</p>
				<MadeWithNotara />
			</div>
		);

	return (
		<>
			<ReadOnlyPage data={state.data} token={token} />
			<MadeWithNotara />
		</>
	);
}

/**
 * The one piece of Notara a public reader sees.
 *
 * Kept quiet on purpose: a shared page belongs to whoever wrote it, and a
 * banner on someone else's document is a worse advert than a line of small
 * text at the bottom.
 */
function MadeWithNotara() {
	return (
		<footer className="max-w-[720px] mx-auto px-6 pb-12 pt-6 text-center">
			<a
				href="https://github.com/DnzzL/notara"
				target="_blank"
				rel="noreferrer"
				className="text-[12px] text-text-3 no-underline hover:text-text-2"
			>
				Made with Notara
			</a>
		</footer>
	);
}

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/p/$token",
	component: PublicPageRoute,
});
