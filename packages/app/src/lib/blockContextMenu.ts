/**
 * Which right-click opens a block's context menu.
 *
 * For most blocks, anywhere. For a database it has to be narrower: the block
 * wrapper spans the whole table — toolbar, header, every row and every cell —
 * and the database menu's only item deletes the database. Right-clicking a
 * cell to paste, or (on touch) resting a finger on a row long enough to fire
 * `contextmenu`, was putting a delete confirmation in front of people who had
 * asked for nothing.
 *
 * The target is the database's name. It is the database itself, it is present
 * in all three views and at every width, and it is not somewhere a finger
 * lands by accident.
 */

/** The bit of an event target this decision actually reads. */
type MenuTarget = {
	tagName: string;
	closest: (selector: string) => unknown;
};

export function shouldOpenBlockMenu(
	blockType: string,
	target: MenuTarget,
): boolean {
	if (blockType !== "database") return true;
	// While the name is being renamed it is an <input>, and a caret wants the
	// browser's own menu — cut, paste, spelling.
	if (target.tagName === "INPUT") return false;
	return target.closest(".db-toolbar-name") != null;
}
