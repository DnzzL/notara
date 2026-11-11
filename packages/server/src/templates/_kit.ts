/**
 * Template file contract. One file per template in this folder, named
 * `NN-<id>.ts` (NN = digits, required; orders the catalogue), loaded by `handlers/templates.ts`:
 *
 *   export default { id, title, icon, description, blocks, children? } satisfies TemplateDef;
 *
 * - `blocks`: plain blocks (use h1/h2/p/TOGGLE/… below), `database` blocks
 *   (`fields`, `views`, sample `records`) or `childLinks` (index of sub-pages).
 * - fields: `relation` fields name their target database via `relationTargetName`
 *   (own name = self-relation); records fill them via `relations` (target titles).
 * - views: `table` or `board` (a board needs `groupByFieldName`).
 * - records: `values` by field name, `relations`, `pageLinks` (sub-page titles).
 * - `children`: nested sub-pages, same shape as a page.
 * Other files (e.g. `_kit.ts`) are ignored. A snapshot test guards the output.
 */
export type PlainBlock = { kind: "block"; type: string; content: string };
export type DatabaseBlock = {
	kind: "database";
	name: string;
	titleLabel: string;
	fields: FieldDef[];
	views: ViewDef[];
	records: RecordDef[];
};
/** Emits one `pageLink` block per child page, in order — an inline index of sub-pages. */
export type ChildLinksBlock = { kind: "childLinks" };
export type BlockDef = PlainBlock | DatabaseBlock | ChildLinksBlock;
export type FieldDef = {
	name: string;
	type: string;
	options?: string[];
	/** For `relation` fields: the `name` of the target database block (use this
	 *  database's own name for a self-relation). Resolved to its id at build time. */
	relationTargetName?: string;
};
export type ViewDef = {
	name: string;
	type: "table" | "board";
	groupByFieldName?: string;
};
export type RecordDef = {
	title: string;
	values?: Record<string, string>;
	/** `relation` field values, by field name → target record titles. */
	relations?: Record<string, string[]>;
	/** `page` field values, by field name → linked page title (e.g. a sub-page). */
	pageLinks?: Record<string, string>;
};

export interface PageDef {
	title: string;
	icon: string;
	blocks: BlockDef[];
	children?: PageDef[];
}

export interface TemplateDef extends PageDef {
	id: string;
	description: string;
}

export const CALLOUT = (summary: string, body?: string) =>
	`<details open=""><summary>${summary}</summary><div data-details-content=""><p>${body ?? ""}</p></div></details>`;

/** Collapsible section. `bodyHtml` may contain block-level HTML (p, ul, pre…). */
export const TOGGLE = (summary: string, bodyHtml: string) =>
	`<details open=""><summary>${summary}</summary><div data-details-content="">${bodyHtml}</div></details>`;

export const TODO = (text: string, checked = false) =>
	`<ul class="task-list"><li data-checked="${checked}">${text}</li></ul>`;

export const BULLET = (text: string) => `<ul><li>${text}</li></ul>`;
export const UL = (items: string[]) =>
	`<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
export const OL = (items: string[]) =>
	`<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;

// Shorthand block constructors.
export const h1 = (t: string): PlainBlock => ({
	kind: "block",
	type: "heading1",
	content: `<h1>${t}</h1>`,
});
export const h2 = (t: string): PlainBlock => ({
	kind: "block",
	type: "heading2",
	content: `<h2>${t}</h2>`,
});
export const p = (t: string): PlainBlock => ({
	kind: "block",
	type: "paragraph",
	content: `<p>${t}</p>`,
});
