import emojiData from "emojibase-data/en/data.json" with { type: "json" };
import messages from "emojibase-data/en/messages.json" with { type: "json" };
import { useEffect, useRef, useState } from "react";
import { useMenuKeyboard } from "../lib/useMenuKeyboard.js";

interface EmojiEntry {
	label: string;
	hexcode: string;
	tags?: string[];
	emoji: string;
	text: string;
	type: number;
	order: number;
	group: number;
	subgroup: number;
	version: number;
}

const ALL_EMOJI = (emojiData as EmojiEntry[]).filter(
	(e) => e.type !== 0 && e.group !== undefined && e.emoji,
);

const GROUP_LABELS: Record<number, string> = {};
const GROUP_ORDER: Record<number, number> = {};
for (const g of messages.groups) {
	GROUP_LABELS[g.order] = g.message;
	GROUP_ORDER[g.order] = g.order;
}

const GROUP_IDS = Array.from(new Set(ALL_EMOJI.map((e) => e.group))).sort(
	(a, b) => GROUP_ORDER[a] - GROUP_ORDER[b],
);

const CATEGORIES = GROUP_IDS.map((gid) => ({
	name: GROUP_LABELS[gid] ?? `Group ${gid}`,
	emoji: ALL_EMOJI.filter((e) => e.group === gid),
}));

const EMOJI_BTN =
	"text-[19px] leading-none bg-transparent border-none cursor-pointer p-[3px] rounded transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 w-9 h-9 flex items-center justify-center";

interface Props {
	open: boolean;
	anchor: { top: number; left: number } | null;
	onClose: () => void;
	onSelect: (emoji: string | null) => void;
}

export function EmojiPicker({ open, anchor, onClose, onSelect }: Props) {
	const [query, setQuery] = useState("");
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			setQuery("");
			return;
		}
		const handleClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		window.addEventListener("mousedown", handleClick);
		return () => {
			window.removeEventListener("mousedown", handleClick);
		};
	}, [open, onClose]);

	const q = query.toLowerCase().trim();
	const filtered = q
		? ALL_EMOJI.filter(
				(e) =>
					e.label.toLowerCase().includes(q) ||
					(e.tags ?? []).some((t) => t.toLowerCase().includes(q)),
			)
		: null;
	const flat = filtered ?? CATEGORIES.flatMap((cat) => cat.emoji);

	const { itemProps } = useMenuKeyboard({
		count: flat.length,
		onSelect: (i) => {
			const e = flat[i];
			if (!e) return;
			onSelect(e.emoji);
			onClose();
		},
		onClose,
		enabled: open,
	});

	if (!open || !anchor) return null;

	return (
		<div
			ref={ref}
			className="bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-xl)] w-[320px] max-h-[360px] flex flex-col overflow-hidden"
			style={{
				position: "fixed",
				top: anchor.top,
				left: anchor.left,
				zIndex: 1000,
			}}
		>
			{/* Header: search + remove */}
			<div className="flex items-center gap-2 px-2 pt-2 pb-1.5 border-b border-border shrink-0">
				<input
					name="emoji-search"
					className="flex-1 px-2.5 py-1.5 border border-border rounded text-[13px] outline-none bg-surface-2 text-text placeholder:text-text-3 focus:border-accent focus:shadow-[0_0_0_2px_var(--accent-dim)] transition-[border-color,box-shadow] duration-[var(--t)] ease-[var(--ease)]"
					placeholder="Search emoji…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				<button
					className="shrink-0 bg-transparent border border-border rounded text-[12px] px-2 py-1.5 cursor-pointer text-text-3 transition-[background,color,border-color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text hover:border-border-mid leading-none"
					onClick={() => {
						onSelect(null);
						onClose();
					}}
					title="Remove icon"
				>
					Remove
				</button>
			</div>

			{/* Emoji grid / browse */}
			<div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-sm">
				{filtered ? (
					filtered.length > 0 ? (
						<div className="grid grid-cols-8 gap-0.5 p-2">
							{filtered.map((e, i) => (
								<button
									key={e.hexcode}
									{...itemProps(i)}
									className={`${EMOJI_BTN} data-[active]:bg-surface-3`}
									onClick={() => {
										onSelect(e.emoji);
										onClose();
									}}
									title={e.label}
								>
									{e.emoji}
								</button>
							))}
						</div>
					) : (
						<div className="py-8 px-4 text-text-3 text-[13px] text-center">
							No emojis found
						</div>
					)
				) : (
					<div className="p-2">
						{(() => {
							let offset = 0;
							return CATEGORIES.map((cat) => {
								const catOffset = offset;
								offset += cat.emoji.length;
								return (
									<div key={cat.name} className="mb-1">
										<div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-3 px-1 py-1.5">
											{cat.name}
										</div>
										<div className="grid grid-cols-8 gap-0.5">
											{cat.emoji.map((e, i) => (
												<button
													key={e.hexcode}
													{...itemProps(catOffset + i)}
													className={`${EMOJI_BTN} data-[active]:bg-surface-3`}
													onClick={() => {
														onSelect(e.emoji);
														onClose();
													}}
													title={e.label}
												>
													{e.emoji}
												</button>
											))}
										</div>
									</div>
								);
							});
						})()}
					</div>
				)}
			</div>
		</div>
	);
}
