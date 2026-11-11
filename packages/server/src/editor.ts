/**
 * Who is making a write. Handed to the page and block write handlers — the one
 * place every door (RPC, REST, MCP) goes through — which stamp it on the row.
 * `key` is set only for an API-key caller; `name` is a snapshot (ADR-014).
 */
export type Editor = {
	readonly userId: string;
	readonly key?: { readonly id: string; readonly name: string };
};

/** Column values for `updated_by`, `updated_by_key_id`, `updated_by_key_name`. */
export const editorColumns = (
	e: Editor,
): [string, string | null, string | null] => [
	e.userId,
	e.key?.id ?? null,
	e.key?.name ?? null,
];
