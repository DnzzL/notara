import { useEffect, useState } from "react";
import { selectPageByIdWithCascade } from "../../lib/page-loader.js";
import { api } from "../../rpc-client.js";
import { usePageStore } from "../../stores/pageStore.js";
import { Button, IconButton } from "../ui/index.js";
import { RecordProperties } from "./RecordProperties.js";
import { ShortId } from "./ShortId.js";

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
		shortId: string;
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
			className="fixed inset-0 bg-scrim backdrop-blur-[4px] z-[9000] flex justify-end [animation:fade-in_0.14s_var(--ease)]"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<aside
				className="w-[min(520px,90vw)] h-full bg-surface border-l border-border-mid shadow-[var(--shadow-xl)] flex flex-col px-7 pb-7 pt-[18px] overflow-y-auto [animation:slide-from-right_0.18s_var(--ease-spring)] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-sm"
				role="dialog"
				aria-label="Record details"
			>
				<header className="flex justify-between items-center mb-0.5">
					<ShortId id={record.shortId} />
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

				<RecordProperties
					recordId={record.id}
					fields={fields}
					values={values}
					databases={databases}
					allRecords={allRecords}
					onChanged={onChanged}
				/>
			</aside>
		</div>
	);
}
