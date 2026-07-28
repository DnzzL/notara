import type { Workspace } from "@notara/shared";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { signOut } from "../auth-client.js";
import { api, setCurrentWorkspaceId } from "../rpc-client.js";

interface WorkspaceSwitcherProps {
	onCollapse?: () => void;
	onOpenImport?: () => void;
	onOpenTrash?: () => void;
}

export function WorkspaceSwitcher({
	onCollapse,
	onOpenImport,
	onOpenTrash,
}: WorkspaceSwitcherProps = {}) {
	const navigate = useNavigate();
	const params = useParams({ strict: false }) as { workspaceSlug?: string };
	const [open, setOpen] = useState(false);
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [current, setCurrent] = useState<Workspace | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		api.getMyWorkspaces().then((ws) => {
			setWorkspaces(ws);
			const found = ws.find((w) => w.slug === params.workspaceSlug);
			setCurrent(found ?? ws[0] ?? null);
		});
	}, [params.workspaceSlug]);

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		};
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	const switchTo = (ws: Workspace) => {
		setCurrentWorkspaceId(ws.id);
		setOpen(false);
		navigate({ to: "/$workspaceSlug", params: { workspaceSlug: ws.slug } });
	};

	const handleSignOut = async () => {
		await signOut();
		setCurrentWorkspaceId(null);
		navigate({ to: "/login" });
	};

	return (
		<div
			className="relative px-2 pb-1.5 pt-2 border-b border-border-sb"
			ref={ref}
		>
			<div className="flex items-center gap-0.5">
				<button
					className="flex items-center gap-[9px] flex-1 min-w-0 bg-transparent border-none cursor-pointer px-2 py-1.5 rounded text-[13.5px] text-text-sb [font-family:var(--font-ui)] transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)]"
					onClick={() => setOpen(!open)}
					title="Switch workspace"
				>
					<span className="w-[26px] h-[26px] rounded bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 tracking-[-0.02em]">
						{current ? current.name[0].toUpperCase() : "?"}
					</span>
					<span className="flex-1 text-left font-semibold text-[13.5px] overflow-hidden text-ellipsis whitespace-nowrap text-text-sb tracking-[-0.01em]">
						{current?.name ?? "Select workspace"}
					</span>
					<span className="text-text-sb-3 text-[11px]">▾</span>
				</button>
				{onCollapse && (
					<button
						className="shrink-0 bg-transparent border-none cursor-pointer text-text-sb-3 text-[15px] w-7 h-7 flex items-center justify-center rounded transition-[color,background] duration-[var(--t)] ease-[var(--ease)] hover:bg-[rgba(10,10,10,0.05)] hover:text-text-sb"
						onClick={onCollapse}
						title="Collapse sidebar (⌘\\)"
						aria-label="Collapse sidebar"
					>
						«
					</button>
				)}
			</div>

			{open && (
				<div className="absolute top-[calc(100%-2px)] left-2 right-2 bg-surface border border-border-mid rounded shadow-[var(--shadow-lg)] z-[200] overflow-hidden">
					<div className="p-1 border-b border-border">
						{workspaces.map((ws) => (
							<button
								key={ws.id}
								className={`flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text ${ws.id === current?.id ? "font-medium text-text" : ""}`}
								onClick={() => switchTo(ws)}
							>
								<span className="w-[26px] h-[26px] rounded bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 tracking-[-0.02em]">
									{ws.name[0].toUpperCase()}
								</span>
								<span>{ws.name}</span>
								{ws.id === current?.id && (
									<span className="ml-auto text-accent">✓</span>
								)}
							</button>
						))}
					</div>

					<div className="p-1 border-b border-border">
						<div className="[font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.12em] text-text-3 px-2.5 pt-1 pb-[5px]">
							Settings
						</div>
						{current && (
							<button
								className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									setOpen(false);
									navigate({
										to: "/settings/$workspaceSlug",
										params: { workspaceSlug: current.slug },
									});
								}}
							>
								Settings
							</button>
						)}
						{onOpenImport && (
							<button
								className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									setOpen(false);
									onOpenImport();
								}}
							>
								Import
							</button>
						)}
						{onOpenTrash && (
							<button
								className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
								onClick={() => {
									setOpen(false);
									onOpenTrash();
								}}
							>
								Trash
							</button>
						)}
					</div>

					<div className="p-1 border-b border-border">
						<div className="[font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.12em] text-text-3 px-2.5 pt-1 pb-[5px]">
							Account
						</div>
						<button
							className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
							onClick={() => {
								setOpen(false);
								navigate({ to: "/workspaces" });
							}}
						>
							+ New workspace
						</button>
						<button
							className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
							onClick={() => {
								setOpen(false);
								navigate({ to: "/workspaces" });
							}}
						>
							Join with invite
						</button>
						<button
							className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
							onClick={() => {
								setOpen(false);
								navigate({ to: "/admin" });
							}}
						>
							Admin panel
						</button>
						<button
							className="flex items-center gap-2 w-full px-2.5 py-[7px] bg-transparent border-none cursor-pointer text-[13px] text-text-2 text-left rounded-lg [font-family:var(--font-ui)] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text text-danger hover:bg-danger-dim! hover:text-danger!"
							onClick={handleSignOut}
						>
							Sign out
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
