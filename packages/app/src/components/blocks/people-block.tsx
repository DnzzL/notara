import { useEffect, useState } from "react";
import { api, getCurrentWorkspaceId } from "../../rpc-client.js";
import { Button } from "../ui/index.js";
import type { BlockRendererProps } from "./renderer-registry.js";

/** A people-assignment block. Content is a JSON array of user IDs. */
export function PeopleBlock({ block, onUpdateBlock }: BlockRendererProps) {
	const userIds: string[] = (() => {
		try {
			return JSON.parse(block.content || "[]");
		} catch {
			return [];
		}
	})();
	const [members, setMembers] = useState<
		Array<{ userId: string; name: string; email: string }>
	>([]);
	const [pickerOpen, setPickerOpen] = useState(userIds.length === 0);
	const [query, setQuery] = useState("");

	useEffect(() => {
		const wsId = getCurrentWorkspaceId();
		if (!wsId) return;
		api
			.getWorkspaceMembers({ workspaceId: wsId })
			.then(setMembers)
			.catch(() => {
				/* ignore */
			});
	}, []);

	const toggle = (uid: string) => {
		const next = userIds.includes(uid)
			? userIds.filter((x) => x !== uid)
			: [...userIds, uid];
		onUpdateBlock(block.id, JSON.stringify(next));
	};

	const q = query.trim().toLowerCase();
	const visible = q
		? members.filter(
				(m) =>
					m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
			)
		: members;

	return (
		<div className="py-1" data-block-id={block.id}>
			{userIds.length > 0 && !pickerOpen && (
				<div className="flex flex-wrap gap-1.5 items-center">
					{userIds.map((uid) => {
						const m = members.find((x) => x.userId === uid);
						const name = m?.name || uid.slice(0, 8);
						const initial = name.charAt(0).toUpperCase();
						return (
							<span
								key={uid}
								className="inline-flex items-center gap-1.5 bg-surface-3 border border-border rounded-full px-2 py-[2px] pl-[3px] text-[13px] cursor-default text-text-2 transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-4"
								onClick={() => setPickerOpen(true)}
								title="Click to edit"
							>
								<span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-accent-dim text-accent-2 text-[11px] font-semibold shrink-0">
									{initial}
								</span>
								<span className="overflow-hidden text-ellipsis whitespace-nowrap">
									{name}
								</span>
								<button
									className="bg-transparent border-none cursor-pointer text-text-3 text-[14px] p-0 pl-1 leading-none opacity-0 transition-[opacity] duration-[var(--t)] ease-[var(--ease)] group-hover:opacity-100 hover:opacity-100"
									onClick={(e) => {
										e.stopPropagation();
										toggle(uid);
									}}
									title="Remove"
								>
									×
								</button>
							</span>
						);
					})}
					<button
						className="bg-transparent border-[1.5px] border-dashed border-border-mid rounded-full w-7 h-7 inline-flex items-center justify-center cursor-pointer text-text-3 text-[16px] transition-[border-color,color] duration-[var(--t)] ease-[var(--ease)] hover:border-accent hover:text-accent"
						onClick={() => setPickerOpen(true)}
					>
						+
					</button>
				</div>
			)}
			{pickerOpen && (
				<div
					className="bg-surface border border-border-mid rounded-lg p-1.5 shadow-[var(--shadow-lg)] max-h-[280px] flex flex-col"
					onMouseDown={(e) => e.stopPropagation()}
				>
					<input
						name="people-search"
						className="w-full border border-border rounded-lg px-2 py-1.5 text-[13px] outline-none bg-surface-2 text-text box-border"
						placeholder="Search people\u2026"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault();
								setPickerOpen(false);
							}
						}}
					/>
					<div className="flex-1 overflow-y-auto mt-1">
						{visible.length === 0 ? (
							<div className="px-2 py-2.5 text-text-3 text-[13px]">
								No people found
							</div>
						) : (
							visible.map((m) => {
								const selected = userIds.includes(m.userId);
								return (
									<button
										key={m.userId}
										className="flex items-center gap-2 w-full px-2 py-1.5 bg-transparent border-none rounded cursor-pointer text-left text-[13px] text-text transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3"
										onClick={() => {
											toggle(m.userId);
											if (selected && userIds.length <= 1) setPickerOpen(false);
										}}
									>
										<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-dim text-accent-2 text-[11px] font-semibold shrink-0">
											{m.name.charAt(0).toUpperCase()}
										</span>
										<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
											{m.name}
										</span>
										<span className="text-[11px] text-text-3">{m.email}</span>
										{selected && (
											<span className="text-accent text-[14px]">✓</span>
										)}
									</button>
								);
							})
						)}
					</div>
					{userIds.length > 0 && (
						<Button
							variant="primary"
							size="sm"
							className="w-full mt-1"
							onClick={() => setPickerOpen(false)}
						>
							Done
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
