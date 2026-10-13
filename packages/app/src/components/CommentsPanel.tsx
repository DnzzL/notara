import type { Comment } from "@notara/shared";
import { useEffect, useId, useState } from "react";
import { useSession } from "../auth-client.js";
import { api, getCurrentWorkspaceId } from "../rpc-client.js";
import { usePageStore } from "../store.js";
import { Button } from "./ui/index.js";

/** The flat comment thread under the current page. */
export function CommentsPanel() {
	const pageId = usePageStore((s) => s.currentPage?.id);
	const { data: session } = useSession();
	const [comments, setComments] = useState<readonly Comment[]>([]);
	const [members, setMembers] = useState<
		ReadonlyArray<{ userId: string; name: string; handle: string }>
	>([]);
	const names = Object.fromEntries(members.map((m) => [m.userId, m.name]));
	/** The `@query` being typed before the caret, and the highlighted pick. */
	const [mention, setMention] = useState<{ query: string; at: number } | null>(
		null,
	);
	const [picked, setPicked] = useState(0);
	const listId = useId();
	const [draft, setDraft] = useState("");
	const [editing, setEditing] = useState<{ id: string; body: string } | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!pageId) return;
		// A new page starts clean: no draft or edit carried over from the last one,
		// and a late answer for the last page is dropped.
		let current = true;
		setComments([]);
		setDraft("");
		setEditing(null);
		setError(null);
		api
			.listComments({ pageId })
			.then((cs) => current && setComments(cs))
			.catch(() => current && setError("Comments could not be loaded"));
		return () => {
			current = false;
		};
	}, [pageId]);

	useEffect(() => {
		const wsId = getCurrentWorkspaceId();
		if (!wsId) return;
		api
			.getWorkspaceMembers({ workspaceId: wsId })
			.then((ms) => setMembers(ms))
			.catch(() => {
				/* names fall back to "Someone" */
			});
	}, []);

	if (!pageId) return null;

	const run = (p: Promise<unknown>) =>
		p
			.then(() => setError(null))
			.catch(() => setError("That did not go through"));

	const add = () => {
		if (!draft.trim()) return;
		run(
			api.addComment({ pageId, body: draft }).then((c) => {
				setComments((cs) => [...cs, c]);
				setDraft("");
			}),
		);
	};

	const save = () => {
		if (!editing?.body.trim()) return;
		run(
			api.updateComment(editing).then((c) => {
				setComments((cs) => cs.map((x) => (x.id === c.id ? c : x)));
				setEditing(null);
			}),
		);
	};

	const remove = (id: string) =>
		run(
			api
				.deleteComment({ id })
				.then(() => setComments((cs) => cs.filter((x) => x.id !== id))),
		);

	const suggestions = mention
		? members
				.filter(
					(m) =>
						m.handle.startsWith(mention.query.toLowerCase()) ||
						m.name.toLowerCase().includes(mention.query.toLowerCase()),
				)
				.slice(0, 5)
		: [];

	/** Replace the `@query` being typed with `@handle `. */
	const insertMention = (handle: string) => {
		if (!mention) return;
		const end = mention.at + mention.query.length;
		setDraft((d) => `${d.slice(0, mention.at)}${handle} ${d.slice(end)}`);
		setMention(null);
	};

	const submitOnModEnter =
		(submit: () => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				submit();
			}
		};

	return (
		<section className="mt-6 pt-2 border-t border-border" aria-label="Comments">
			<h2 className="px-3 py-2 text-[13px] font-medium text-text-2">
				{comments.length} comment{comments.length !== 1 ? "s" : ""}
			</h2>
			<ul className="flex flex-col gap-3 px-3">
				{comments.map((c) => (
					<li key={c.id} className="text-[13.5px]">
						<div className="flex items-baseline gap-2 text-[12px] text-text-3">
							<span className="font-medium text-text-2">
								{names[c.authorId] ?? "Someone"}
							</span>
							{c.keyName && <span>via {c.keyName}</span>}
							<time dateTime={c.createdAt}>
								{new Date(c.createdAt).toLocaleString()}
							</time>
							{c.updatedAt && <span>(edited)</span>}
							{c.authorId === session?.user.id && editing?.id !== c.id && (
								<span className="ml-auto flex gap-1">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setEditing({ id: c.id, body: c.body })}
										aria-label={`Edit your comment of ${new Date(c.createdAt).toLocaleString()}`}
									>
										Edit
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => remove(c.id)}
										aria-label={`Delete your comment of ${new Date(c.createdAt).toLocaleString()}`}
									>
										Delete
									</Button>
								</span>
							)}
						</div>
						{editing?.id === c.id ? (
							<div className="mt-1 flex flex-col gap-1.5">
								<textarea
									aria-label="Edit comment"
									className="w-full min-h-[60px] rounded border border-border-mid bg-surface p-2 text-text"
									value={editing.body}
									maxLength={10_000}
									onChange={(e) =>
										setEditing({ id: c.id, body: e.target.value })
									}
									onKeyDown={submitOnModEnter(save)}
								/>
								<span className="flex gap-1.5">
									<Button size="sm" variant="primary" onClick={save}>
										Save
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setEditing(null)}
									>
										Cancel
									</Button>
								</span>
							</div>
						) : (
							<p className="mt-0.5 whitespace-pre-wrap text-text">{c.body}</p>
						)}
					</li>
				))}
			</ul>
			<div className="relative mt-3 flex flex-col gap-1.5 px-3">
				<textarea
					aria-label="Add a comment"
					placeholder="Add a comment… (@ to mention)"
					className="w-full min-h-[60px] rounded border border-border-mid bg-surface p-2 text-[13.5px] text-text"
					value={draft}
					maxLength={10_000}
					aria-autocomplete="list"
					aria-expanded={suggestions.length > 0}
					aria-controls={listId}
					aria-activedescendant={
						suggestions.length > 0 ? `${listId}-${picked}` : undefined
					}
					onChange={(e) => {
						setDraft(e.target.value);
						const before = e.target.value.slice(0, e.target.selectionStart);
						const m = /(?:^|[^\w@.])@([a-z0-9_-]*)$/i.exec(before);
						setMention(
							m ? { query: m[1], at: before.length - m[1].length } : null,
						);
						setPicked(0);
					}}
					onKeyDown={(e) => {
						if (suggestions.length > 0) {
							if (e.key === "ArrowDown" || e.key === "ArrowUp") {
								e.preventDefault();
								const step = e.key === "ArrowDown" ? 1 : -1;
								setPicked(
									(p) => (p + step + suggestions.length) % suggestions.length,
								);
								return;
							}
							if (e.key === "Enter" || e.key === "Tab") {
								e.preventDefault();
								insertMention(suggestions[picked].handle);
								return;
							}
							if (e.key === "Escape") {
								e.preventDefault();
								e.stopPropagation();
								setMention(null);
								return;
							}
						}
						submitOnModEnter(add)(e);
					}}
				/>
				{suggestions.length > 0 && (
					<div
						id={listId}
						role="listbox"
						aria-label="Members to mention"
						className="absolute left-3 top-full z-10 mt-1 min-w-[200px] rounded border border-border-mid bg-surface py-1 shadow-[var(--shadow-xl)]"
					>
						{suggestions.map((m, i) => (
							<div
								key={m.userId}
								id={`${listId}-${i}`}
								role="option"
								aria-selected={i === picked}
								className={`cursor-pointer px-2.5 py-1 text-[13px] ${i === picked ? "bg-surface-3" : ""}`}
								onMouseDown={(e) => {
									e.preventDefault();
									insertMention(m.handle);
								}}
							>
								<span className="text-text">@{m.handle}</span>{" "}
								<span className="text-text-3">{m.name}</span>
							</div>
						))}
					</div>
				)}
				<span className="flex items-center gap-2">
					<Button
						size="sm"
						variant="primary"
						onClick={add}
						disabled={!draft.trim()}
					>
						Comment
					</Button>
					{error && (
						<span role="alert" className="text-[12px] text-danger">
							{error}
						</span>
					)}
				</span>
			</div>
		</section>
	);
}
