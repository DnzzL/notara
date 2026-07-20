import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../ui/cn.js";
import {
	useDatabaseStore,
	selectDbViews,
	selectActiveViewId,
	selectIsViewDirty,
	selectSavedViewConfig,
	parseViewConfig,
	serializeViewConfig,
} from "../../stores/databaseStore.js";
import {
	selectFilters,
	selectSorts,
	selectBoardHidden,
	selectBoardGroupBy,
} from "../../stores/databaseStore.js";
import type { DatabaseView } from "@notara/shared";

export function ViewSwitcher({
	databaseId,
	currentViewType,
}: {
	databaseId: string;
	currentViewType: "table" | "board" | "calendar";
}) {
	const [open, setOpen] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [savingAs, setSavingAs] = useState(false);
	const [saveName, setSaveName] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
	const saveInputRef = useRef<HTMLInputElement>(null);

	const dbViews = useDatabaseStore((s) => selectDbViews(s, databaseId));
	const activeViewId = useDatabaseStore((s) =>
		selectActiveViewId(s, databaseId),
	);
	const activeFilters = useDatabaseStore((s) => selectFilters(s, databaseId));
	const activeSorts = useDatabaseStore((s) => selectSorts(s, databaseId));
	const boardHidden = useDatabaseStore((s) => selectBoardHidden(s, databaseId));
	const boardGroupBy = useDatabaseStore((s) =>
		selectBoardGroupBy(s, databaseId),
	);

	const isDirty = useDatabaseStore((s) => selectIsViewDirty(s, databaseId));
	const savedConfig = useDatabaseStore((s) =>
		selectSavedViewConfig(s, databaseId),
	);

	const createView = useDatabaseStore((s) => s.createView);
	const updateView = useDatabaseStore((s) => s.updateView);
	const deleteView = useDatabaseStore((s) => s.deleteView);
	const switchView = useDatabaseStore((s) => s.switchView);
	const setDefaultView = useDatabaseStore((s) => s.setDefaultView);
	const loadDbViews = useDatabaseStore((s) => s.loadDbViews);
	const setSavedViewConfig = useDatabaseStore((s) => s.setSavedViewConfig);
	const hydrateView = useDatabaseStore((s) => s.hydrateView);

	// Load views on mount
	useEffect(() => {
		loadDbViews(databaseId);
	}, [databaseId, loadDbViews]);

	useEffect(() => {
		if (!open) {
			setRenamingId(null);
			setSavingAs(false);
			return;
		}
		const handler = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			)
				setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	useEffect(() => {
		if (renamingId && renameInputRef.current) renameInputRef.current.focus();
	}, [renamingId]);

	useEffect(() => {
		if (savingAs && saveInputRef.current) saveInputRef.current.focus();
	}, [savingAs]);

	const activeView = dbViews.find((v) => v.id === activeViewId) || null;
	const activeLabel = activeView?.name || "All";

	const handleSelect = useCallback(
		(view: DatabaseView | null) => {
			switchView(databaseId, view);
			setOpen(false);
		},
		[databaseId, switchView],
	);

	const handleSaveAs = useCallback(async () => {
		const name = saveName.trim();
		if (!name) return;
		const config = serializeViewConfig(activeFilters, activeSorts, boardHidden);
		const viewType = currentViewType;
		const newView = await createView(
			databaseId,
			name,
			viewType,
			boardGroupBy,
			config,
		);
		setSaveName("");
		setSavingAs(false);
		if (newView) switchView(databaseId, newView);
		setOpen(false);
	}, [
		saveName,
		activeFilters,
		activeSorts,
		boardHidden,
		boardGroupBy,
		currentViewType,
		databaseId,
		createView,
		switchView,
	]);

	/** Save current config to the active saved view. */
	const handleSave = useCallback(async () => {
		if (!activeViewId) return;
		const config = serializeViewConfig(activeFilters, activeSorts, boardHidden);
		await updateView(activeViewId, {
			config,
			groupByFieldId: boardGroupBy,
			type: currentViewType,
		});
		// Update the in-memory snapshot so the view is no longer dirty
		setSavedViewConfig(databaseId, {
			filters: activeFilters,
			sorts: activeSorts,
			groupBy: boardGroupBy,
			boardHidden,
			viewType: currentViewType,
		});
		setOpen(false);
	}, [
		activeViewId,
		activeFilters,
		activeSorts,
		boardHidden,
		boardGroupBy,
		currentViewType,
		databaseId,
		updateView,
		setSavedViewConfig,
	]);

	/** Reset current config to the saved snapshot. */
	const handleReset = useCallback(() => {
		if (!savedConfig) return;
		hydrateView(databaseId, {
			filters: savedConfig.filters,
			sorts: savedConfig.sorts,
			groupBy: savedConfig.groupBy,
			boardHidden: savedConfig.boardHidden,
		});
		setOpen(false);
	}, [savedConfig, databaseId, hydrateView]);

	const handleRename = useCallback(
		async (viewId: string) => {
			const name = renameValue.trim();
			if (!name) return;
			await updateView(viewId, { name });
			setRenamingId(null);
			setRenameValue("");
		},
		[renameValue, updateView],
	);

	const handleDelete = useCallback(
		async (view: DatabaseView) => {
			if (!window.confirm(`Delete view "${view.name}"?`)) return;
			await deleteView(databaseId, view.id);
			// If it was active, reset to 'All'
			if (activeViewId === view.id) {
				switchView(databaseId, null);
			}
		},
		[databaseId, activeViewId, deleteView, switchView],
	);

	return (
		<div
			ref={dropdownRef}
			style={{ position: "relative", display: "inline-block" }}
		>
			<button
				onClick={() => setOpen((v) => !v)}
				className="bg-transparent border-none cursor-pointer text-[12.5px] text-text px-2 py-1 inline-flex items-center gap-1 rounded-[5px] transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text-2"
				title="Switch view"
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<rect x="1" y="1" width="6" height="6" rx="1" />
					<rect x="9" y="1" width="6" height="6" rx="1" />
					<rect x="1" y="9" width="6" height="6" rx="1" />
					<rect x="9" y="9" width="6" height="6" rx="1" />
				</svg>
				<span style={{ fontWeight: 500 }}>
					{activeLabel}
					{isDirty && activeView && (
						<span
							style={{
								color: "var(--accent, #2eaadc)",
								fontSize: 11,
								marginLeft: 4,
							}}
							title="Unsaved changes"
						>
							●
						</span>
					)}
				</span>
				<svg
					width="10"
					height="10"
					viewBox="0 0 16 16"
					fill="currentColor"
					style={{ opacity: 0.5 }}
				>
					<path
						d="M4 6l4 4 4-4"
						stroke="currentColor"
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>

			{open && (
				<div
					className="z-[200] absolute top-[calc(100%+4px)] left-0 bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-lg)] min-w-[200px] py-1"
					style={{ maxHeight: 320, overflowY: "auto" }}
				>
					{/* 'All' default view */}
					<button
						onClick={() => handleSelect(null)}
						className={cn(
							"w-full bg-transparent border-none text-left px-3 py-1.5 text-[13px] cursor-pointer flex items-center gap-2 transition-[background] duration-[var(--t)] ease-[var(--ease)]",
							!activeView
								? "text-text font-medium"
								: "text-text-2 hover:bg-surface-3",
						)}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="currentColor"
							style={{ opacity: 0.6 }}
						>
							<rect x="1" y="1" width="6" height="6" rx="1" />
							<rect x="9" y="1" width="6" height="6" rx="1" />
							<rect x="1" y="9" width="6" height="6" rx="1" />
							<rect x="9" y="9" width="6" height="6" rx="1" />
						</svg>
						<span>All</span>
						{!activeView && (
							<span
								style={{ marginLeft: "auto", color: "var(--accent, #2eaadc)" }}
							>
								✓
							</span>
						)}
					</button>

					{dbViews.length > 0 && (
						<div
							style={{
								height: 1,
								background: "var(--border, #e9e9e7)",
								margin: "3px 8px",
							}}
						/>
					)}

					{/* Saved views */}
					{dbViews.map((view) => (
						<div
							key={view.id}
							className="flex items-center group"
							style={{ position: "relative" }}
						>
							{renamingId === view.id ? (
								<input
									ref={renameInputRef}
									type="text"
									name="view-rename"
									value={renameValue}
									onChange={(e) => setRenameValue(e.target.value)}
									onBlur={() => handleRename(view.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleRename(view.id);
										}
										if (e.key === "Escape") {
											setRenamingId(null);
											setRenameValue("");
										}
									}}
									style={{
										flex: 1,
										margin: "2px 3px",
										padding: "2px 6px",
										fontSize: 13,
										border: "1px solid #2eaadc",
										borderRadius: 4,
										outline: "none",
									}}
									onClick={(e) => e.stopPropagation()}
								/>
							) : (
								<button
									onClick={() => handleSelect(view)}
									className={cn(
										"w-full bg-transparent border-none text-left px-3 py-1.5 text-[13px] cursor-pointer flex items-center gap-2 transition-[background] duration-[var(--t)] ease-[var(--ease)]",
										activeViewId === view.id
											? "text-text font-medium"
											: "text-text-2 hover:bg-surface-3",
									)}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 16 16"
										fill="currentColor"
										style={{ opacity: 0.6 }}
									>
										{view.type === "board" ? (
											<rect x="1" y="1" width="14" height="6" rx="1" />
										) : (
											<rect x="1" y="1" width="6" height="6" rx="1" />
										)}
										<rect x="1" y="9" width="6" height="6" rx="1" />
										<rect x="9" y="9" width="6" height="6" rx="1" />
									</svg>
									<span className="truncate" style={{ maxWidth: 100 }}>
										{view.name}
									</span>
									{view.isDefault && (
										<span
											style={{
												color: "var(--accent, #2eaadc)",
												fontSize: 13,
												lineHeight: 1,
											}}
											title="Default view"
										>
											★
										</span>
									)}
									{activeViewId === view.id && (
										<span
											style={{
												marginLeft: "auto",
												color: "var(--accent, #2eaadc)",
											}}
										>
											✓
										</span>
									)}
								</button>
							)}

							{/* Actions (rename/delete) */}
							{renamingId !== view.id && (
								<div
									className="hidden group-hover:flex items-center gap-0.5 absolute right-1 top-1/2 -translate-y-1/2 bg-surface rounded border border-border shadow-sm"
									onClick={(e) => e.stopPropagation()}
								>
									<button
										title={
											view.isDefault ? "Remove default" : "Set as default view"
										}
										onClick={async (e) => {
											e.stopPropagation();
											await setDefaultView(
												databaseId,
												view.isDefault ? null : view.id,
											);
										}}
										className="bg-transparent border-none cursor-pointer text-text-3 px-1 py-0.5 text-[11px] rounded transition-[color] hover:text-accent"
									>
										{view.isDefault ? "★" : "☆"}
									</button>
									<button
										title="Rename view"
										onClick={() => {
											setRenamingId(view.id);
											setRenameValue(view.name);
										}}
										className="bg-transparent border-none cursor-pointer text-text-3 px-1 py-0.5 text-[11px] rounded transition-[color] hover:text-text"
									>
										✏️
									</button>
									<button
										title="Delete view"
										onClick={() => handleDelete(view)}
										className="bg-transparent border-none cursor-pointer text-text-3 px-1 py-0.5 text-[11px] rounded transition-[color] hover:text-red-500"
									>
										🗑️
									</button>
								</div>
							)}
						</div>
					))}

					<div
						style={{
							height: 1,
							background: "var(--border, #e9e9e7)",
							margin: "3px 8px",
						}}
					/>

					{/* Save / Reset (visible when dirty and a saved view is active) */}
					{isDirty && activeView && (
						<>
							<button
								onClick={handleSave}
								className="w-full bg-transparent border-none text-left px-3 py-1.5 text-[13px] cursor-pointer flex items-center gap-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 text-text hover:bg-surface-3"
								style={{ fontWeight: 500 }}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									style={{ opacity: 0.6 }}
								>
									<path
										d="M3 10l3 3 7-8"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								<span>Save</span>
							</button>
							<button
								onClick={handleReset}
								className="w-full bg-transparent border-none text-left px-3 py-1.5 text-[13px] cursor-pointer flex items-center gap-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] text-text-3 hover:text-text hover:bg-surface-3"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									style={{ opacity: 0.6 }}
								>
									<path
										d="M2 8a6 6 0 019.9-4.9M14 8a6 6 0 01-9.9 4.9"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
									<path
										d="M12 2l1.9 4.2-4.2 1"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								<span>Reset</span>
							</button>
							<div
								style={{
									height: 1,
									background: "var(--border, #e9e9e7)",
									margin: "3px 8px",
								}}
							/>
						</>
					)}

					{/* Save as view */}
					{savingAs ? (
						<div style={{ padding: "4px 8px" }}>
							<input
								ref={saveInputRef}
								type="text"
								name="view-save-name"
								value={saveName}
								onChange={(e) => setSaveName(e.target.value)}
								onBlur={handleSaveAs}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleSaveAs();
									}
									if (e.key === "Escape") {
										setSavingAs(false);
										setSaveName("");
									}
								}}
								placeholder="View name..."
								style={{
									width: "100%",
									padding: "4px 6px",
									fontSize: 13,
									border: "1px solid #2eaadc",
									borderRadius: 4,
									outline: "none",
								}}
							/>
						</div>
					) : (
						<button
							onClick={() => setSavingAs(true)}
							className="w-full bg-transparent border-none text-left px-3 py-1.5 text-[13px] text-text-3 cursor-pointer flex items-center gap-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text-2"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="currentColor"
								style={{ opacity: 0.5 }}
							>
								<path
									d="M8 2v12M2 8h12"
									stroke="currentColor"
									strokeWidth="2"
									fill="none"
									strokeLinecap="round"
								/>
							</svg>
							<span>Save as view</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}
