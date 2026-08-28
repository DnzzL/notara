/** How many multi-select values fit in a cell before the rest collapse. */
export const MULTI_SELECT_VISIBLE = 2;

/**
 * Split a multi-select cell into what is shown and what is counted.
 *
 * Several values side by side is the one case the design system reserves a chip
 * for. Past the limit they collapse into a `+N` badge rather than wrapping, so a
 * tag-heavy record stays one `--row` tall.
 */
export function splitMultiSelect(values: string[]): {
	shown: string[];
	hidden: string[];
} {
	return {
		shown: values.slice(0, MULTI_SELECT_VISIBLE),
		hidden: values.slice(MULTI_SELECT_VISIBLE),
	};
}
