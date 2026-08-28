import type { TabItem } from "../ui/Tabs.js";

export type ViewType = "table" | "board" | "calendar";

/**
 * The three ways to render the same records — a toggle, not navigation, so it
 * gets the accent fill. See ui/Tabs.tsx.
 *
 * Declared once: DatabaseView, BoardView and CalendarView each used to
 * hand-write the same three buttons, which is how two of them kept an ink fill
 * for the active segment after the third moved to the accent.
 */
export const VIEW_TYPES: readonly TabItem<ViewType>[] = [
	{ value: "table", label: "Table" },
	{ value: "board", label: "Board" },
	{ value: "calendar", label: "Calendar" },
];
