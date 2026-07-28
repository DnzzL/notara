import { useEffect, useState } from "react";
import { selectPageByIdWithCascade } from "../../lib/page-loader.js";
import { api } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";
import { Button, IconButton } from "../ui/index.js";
import { CellDisplay, InlineCellEditor } from "./CellComponents.js";

export function RecordPanel({
	databaseId,
	record,
	values,
	fields,
	databases,
	allRecords,
	onClose,
	onChanged,
}: {
	databaseId: string;
	record: {
		id: string;
		title: string;
		description: string;
		pageId?: string | null;
	};
	values: Record<string, unknown>;
	fields: Array<{
		id: string;
		name: string;
		type: string;
		options?: string[] | null;
		relationTargetDbId?: string | null;
	}>;
	databases: any[];
	allRecords: Record<string, any[]>;
	onClose: () => void;
	onChanged: () => Promise<void> | void;
}) {
	const [title, setTitle] = useState(record.title || "");
	const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
	const [pageId, setPageId] = useState<string | null>(record.pageId ?? null);
	const [openingPage, setOpeningPage] = useState(false);
	const loadPages = usePageStore((s) => s.loadPages);

	useEffect(() => {
		setTitle(record.title || "");
		setPageId(record.pageId ?? null);
	}, [record.title, record.pageId]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const saveTitle = async () => {
		if (title === record.title) return;
		await api.updateRecord({ id: record.id, title });
		await onChanged();
	};

	const setFieldValue = async (fieldId: string, value: string) => {
		await api.updateFieldValue({ recordId: record.id, fieldId, value });
		setEditingFieldId(null);
		await onChanged();
	};

	const handleOpenAsPage = async () => {
		setOpeningPage(true);
		try {
			const result = await api.openRecordAsPage({ recordId: record.id });
			setPageId(result.pageId);
			await onChanged();
			await loadPages();
			onClose();
			await selectPageByIdWithCascade(result.pageId);
		} finally {
			setOpeningPage(false);
		}
	};

	return (
		<div
			className="fixed inset-0 bg-[rgba(15,18,30,0.3)] backdrop-blur-[4px] z-[9000] flex justify-end [animation:fade-in_0.14s_var(--ease)]"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<aside
				className="w-[min(520px,90vw)] h-full bg-surface border-l border-border-mid shadow-[var(--shadow-xl)] flex flex-col px-7 pb-7 pt-[18px] overflow-y-auto [animation:slide-from-right_0.18s_var(--ease-spring)] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-[3px]"
				role="dialog"
				aria-label="Record details"
			>
				<header className="flex justify-end mb-0.5">
					<IconButton
						variant="ghost"
						size="sm"
						onClick={onClose}
						title="Close (Esc)"
						aria-label="Close"
					>
						×
					</IconButton>
				</header>

				<input
					name="record-title"
					className="[font-family:var(--font-title)] text-[24px] font-bold border-none outline-none bg-transparent w-full pt-1 pb-1.5 text-text tracking-[-0.02em] focus:border-b-2 focus:border-b-accent"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					onBlur={saveTitle}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							(e.target as HTMLInputElement).blur();
						}
					}}
					placeholder="Untitled"
				/>

				{pageId ? (
					<Button
						variant="ghost"
						size="sm"
						className="mb-[18px]"
						onClick={async () => {
							onClose();
							await selectPageByIdWithCascade(pageId);
						}}
					>
						↗ Open page
					</Button>
				) : (
					<Button
						variant="ghost"
						size="sm"
						className="mb-[18px]"
						onClick={handleOpenAsPage}
						disabled={openingPage}
					>
						{openingPage ? "Opening…" : "↗ Open as page"}
					</Button>
				)}

				<section className="grid grid-cols-[130px_1fr] gap-y-1.5 gap-x-3 items-start mb-6">
					{fields.map((field) => {
						const val = values[field.name] ?? "";
						const isEditing = editingFieldId === field.id;
						return (
							<div key={field.id} className="contents">
								<div className="text-text-3 text-[12.5px] pt-[7px]">
									{field.name}
								</div>
								<div className="record-panel-prop-value relative min-h-[28px]">
									{isEditing ? (
										<InlineCellEditor
											field={field as any}
											value={val}
											onSave={(v) => setFieldValue(field.id, v)}
											onCancel={() => setEditingFieldId(null)}
											allRecords={allRecords}
										/>
									) : (
										<div
											className="px-[7px] py-1 rounded-[5px] cursor-pointer min-h-[24px] text-text-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
											onClick={() => setEditingFieldId(field.id)}
										>
											<CellDisplay
												field={field as any}
												value={val}
												databases={databases}
												allRecords={allRecords}
											/>
										</div>
									)}
								</div>
							</div>
						);
					})}
					{fields.length === 0 && (
						<div className="col-span-2 text-text-3 text-[13px] pt-2">
							No properties yet. Add one from the table header.
						</div>
					)}
				</section>
			</aside>
		</div>
	);
}
