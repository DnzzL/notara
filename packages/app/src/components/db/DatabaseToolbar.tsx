import type { ReactNode } from "react";

/**
 * The bar above a database, for all three views.
 *
 * It existed three times — once in DatabaseView, once in BoardView, once in
 * CalendarView — which is how a responsive fix landed on one of them and left
 * the other two wrapping into a ragged block with the database name floating
 * *below* the view selector at 390px. One shell now; the views fill the slots.
 *
 * Desktop: one row, name pushed to the right end.
 * Narrow:  the name is a mono kicker on its own line — it answers "which
 *          database is this?", which is the one thing on the bar you cannot
 *          infer from anything else — and the controls become a single
 *          scrollable row underneath.
 *
 * `db-toolbar-controls` is `display: contents` on desktop, so it is invisible
 * to the flex layout there and only becomes a box below the breakpoint.
 */
export function DatabaseToolbar({
	name,
	children,
}: {
	/** The database's name, editable or not — rendered as the bar's heading. */
	name: ReactNode;
	/** View switcher, view-type tabs, filters, and whatever the view adds. */
	children: ReactNode;
}) {
	return (
		<div className="db-toolbar flex gap-1.5 mb-2.5 items-center flex-wrap py-1">
			<div className="db-toolbar-controls contents">{children}</div>
			<span className="db-toolbar-name">{name}</span>
		</div>
	);
}
