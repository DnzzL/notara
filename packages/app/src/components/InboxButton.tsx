import type { InboxEntry } from "@notara/shared";
import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { selectPageByIdWithCascade } from "../lib/page-loader.js";
import { api, getCurrentWorkspaceId } from "../rpc-client.js";

/**
 * The sidebar's inbox: an unread badge kept live over SSE, and the list of
 * comments that concern the member — mentions, and comments on records they
 * are assigned to.
 */
export function InboxButton({ onNavigate }: { onNavigate?: () => void }) {
	const { workspaceSlug } = useParams({ strict: false }) as {
		workspaceSlug?: string;
	};
	const [unread, setUnread] = useState(0);
	const [open, setOpen] = useState(false);
	const [entries, setEntries] = useState<readonly InboxEntry[]>([]);
	const [names, setNames] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// EventSource cannot set headers, so the server proves membership from
		// this workspace id instead of the usual X-Workspace-Id.
		const workspaceId = getCurrentWorkspaceId();
		if (!workspaceId) return;
		const source = new EventSource(
			`/api/stream/inbox?workspaceId=${encodeURIComponent(workspaceId)}`,
			{ withCredentials: true },
		);
		source.addEventListener("inbox.unread", (e) => {
			setUnread(
				(JSON.parse((e as MessageEvent).data) as { count: number }).count,
			);
		});
		setUnread(0);
		return () => source.close();
		// The slug changes when the member switches workspace; the stream follows.
	}, [workspaceSlug]);

	// Reloaded when opened, and when the count moves while it is open.
	useEffect(() => {
		if (!open) return;
		api
			.listInbox({})
			.then(setEntries)
			.catch(() => setError("The inbox could not be loaded"));
	}, [open, unread, workspaceSlug]);

	useEffect(() => {
		if (!open) return;
		const workspaceId = getCurrentWorkspaceId();
		if (workspaceId)
			api
				.getWorkspaceMembers({ workspaceId })
				.then((ms) =>
					setNames(Object.fromEntries(ms.map((m) => [m.userId, m.name]))),
				)
				.catch(() => {
					/* names fall back to "Someone" */
				});
	}, [open, workspaceSlug]);

	const go = (entry: InboxEntry) => {
		selectPageByIdWithCascade(entry.pageId);
		onNavigate?.();
		setOpen(false);
		if (entry.readAt) return;
		setEntries((es) =>
			es.map((e) =>
				e.id === entry.id ? { ...e, readAt: new Date().toISOString() } : e,
			),
		);
		api.markInboxRead({ ids: [entry.id] }).catch(() => {});
	};

	const readAll = () =>
		api
			.markInboxRead({})
			.then(() =>
				setEntries((es) =>
					es.map((e) =>
						e.readAt ? e : { ...e, readAt: new Date().toISOString() },
					),
				),
			)
			.catch(() => setError("That did not go through"));

	return (
		<div className="flex flex-col">
			<button
				type="button"
				aria-expanded={open}
				aria-controls="inbox-list"
				className="flex items-center justify-between px-2.5 py-[7px] rounded text-[12.5px] text-text-sb-2 hover:bg-[var(--hover-ink)] hover:text-text-sb"
				onClick={() => setOpen((o) => !o)}
			>
				<span>Inbox</span>
				<span aria-live="polite" className="flex items-center">
					{unread > 0 && (
						<span className="min-w-[18px] rounded-full bg-accent px-1.5 text-center text-[11px] font-medium text-white">
							{unread}
							<span className="sr-only"> unread</span>
						</span>
					)}
				</span>
			</button>
			{open && (
				<div
					id="inbox-list"
					className="mt-1 max-h-[320px] overflow-y-auto rounded border border-border-mid bg-surface"
				>
					<div className="flex items-center justify-between px-2.5 py-1.5 text-[11.5px] text-text-3">
						<span>{entries.length === 0 ? "Nothing for you" : "For you"}</span>
						{entries.some((e) => !e.readAt) && (
							<button
								type="button"
								className="underline hover:text-text"
								onClick={readAll}
							>
								Mark all read
							</button>
						)}
					</div>
					{error && (
						<p role="alert" className="px-2.5 py-1 text-[12px] text-danger">
							{error}
						</p>
					)}
					<ul>
						{entries.map((e) => (
							<li key={e.id}>
								<button
									type="button"
									className={`block w-full px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-3 ${e.readAt ? "text-text-3" : "text-text"}`}
									onClick={() => go(e)}
								>
									<span className="block font-medium">
										{!e.readAt && <span aria-hidden="true">● </span>}
										{!e.readAt && <span className="sr-only">Unread: </span>}
										{names[e.authorId] ?? "Someone"}{" "}
										{e.reason === "mention" ? "mentioned you" : "commented"} on{" "}
										{e.pageTitle || "Untitled"}
									</span>
									<span className="block truncate text-text-3">
										{e.excerpt}
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
