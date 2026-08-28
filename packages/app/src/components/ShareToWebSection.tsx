/**
 * The switch that puts a page on the open web.
 *
 * It sits inside the share modal rather than beside it in the page menu,
 * because "who can see this" is one question and answering it in two places
 * invites the state where a page is locked to three people *and* published to
 * everyone with nobody noticing the contradiction.
 *
 * Publishing needs editor rights, enforced on the server. This section is
 * hidden without them rather than shown disabled: a switch you cannot move
 * only raises a question the UI then refuses to answer.
 */
import { useEffect, useState } from "react";
import { api } from "../rpc-client.js";
import { toaster } from "../toaster.js";
import { Button } from "./ui/index.js";

export function ShareToWebSection({
	pageId,
	canManage,
}: {
	pageId: string;
	canManage: boolean;
}) {
	const [token, setToken] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!canManage) return;
		api
			.getPageShare({ pageId })
			.then(setToken)
			.catch(() => setToken(null));
	}, [pageId, canManage]);

	if (!canManage) return null;

	const toggle = async (enabled: boolean) => {
		setBusy(true);
		try {
			setToken(await api.setPageSharing({ pageId, enabled }));
		} catch {
			toaster.create({
				type: "error",
				title: enabled ? "Couldn't publish this page" : "Couldn't unpublish it",
			});
		} finally {
			setBusy(false);
		}
	};

	// Built from the browser's own origin: the server never has to be told what
	// address it is reachable at, which is one fewer thing for a self-hoster to
	// configure wrongly.
	const url = token ? `${window.location.origin}/p/${token}` : null;

	return (
		<section className="mb-5">
			<h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">
				Share to web
			</h3>
			<label className="flex items-center gap-2 text-[13px] text-text-2 cursor-pointer">
				<input
					type="checkbox"
					name="share-to-web"
					checked={token !== null}
					disabled={busy}
					onChange={(e) => toggle(e.target.checked)}
				/>
				Anyone with the link can read this page
			</label>

			{url && (
				<div className="flex gap-2 items-center mt-2.5">
					<code className="flex-1 [font-family:var(--font-mono)] text-[12.5px] bg-surface-2 border border-border rounded-lg px-2.5 py-[7px] text-text overflow-hidden text-ellipsis whitespace-nowrap block">
						{url}
					</code>
					<Button
						size="sm"
						variant="primary"
						onClick={() => {
							navigator.clipboard.writeText(url);
							setCopied(true);
							setTimeout(() => setCopied(false), 2000);
						}}
					>
						{copied ? "Copied!" : "Copy"}
					</Button>
				</div>
			)}

			<p className="mt-2 text-[12px] text-text-3">
				{url
					? "Turning this off breaks the link for good — switching it back on makes a new one. Linked pages, tables and views on this page stay private."
					: "The page becomes readable by anyone holding the link, with no account. It stays out of search engines."}
			</p>
		</section>
	);
}
