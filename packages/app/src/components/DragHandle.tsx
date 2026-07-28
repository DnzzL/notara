/** Drag handle icon that appears on block hover. */
export function DragHandle({
	onDragStart,
	testId,
}: {
	onDragStart: () => void;
	testId?: string;
}) {
	return (
		<div
			className="flex items-center justify-center text-text-3 p-0.5"
			onMouseDown={onDragStart}
			title="Drag to reorder"
			data-testid={testId || "drag-handle"}
			data-drag-handle="true"
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
				<circle cx="5" cy="3" r="1.5" />
				<circle cx="11" cy="3" r="1.5" />
				<circle cx="5" cy="8" r="1.5" />
				<circle cx="11" cy="8" r="1.5" />
				<circle cx="5" cy="13" r="1.5" />
				<circle cx="11" cy="13" r="1.5" />
			</svg>
		</div>
	);
}
