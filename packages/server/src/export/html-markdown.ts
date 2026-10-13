/**
 * The editor's block HTML as markdown. The editor writes well-formed HTML from
 * a small vocabulary (paragraphs, headings, lists and task lists, quotes, code,
 * toggles, callouts, inline marks, links), so a tag tree is enough: no
 * browser-grade parser, and anything unknown keeps its text rather than being
 * dropped.
 */

type Node =
	| { kind: "text"; text: string }
	| { kind: "el"; tag: string; attrs: string; children: Node[] };

const VOID = new Set(["br", "hr", "img", "input"]);

const ENTITY = /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi;
const NAMED: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

/** One decoding pass: `&amp;lt;` is `&lt;`, not `<`. */
const decode = (s: string) =>
	s.replace(ENTITY, (_, e: string) =>
		e[0] === "#"
			? String.fromCodePoint(
					e[1].toLowerCase() === "x"
						? Number.parseInt(e.slice(2), 16)
						: Number(e.slice(1)),
				)
			: NAMED[e.toLowerCase()],
	);

const parse = (html: string): Node[] => {
	const root: Node & { kind: "el" } = {
		kind: "el",
		tag: "",
		attrs: "",
		children: [],
	};
	const stack = [root];
	for (const [, close, tag, attrs, text] of html.matchAll(
		/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g,
	)) {
		const top = stack[stack.length - 1];
		if (text !== undefined) {
			top.children.push({ kind: "text", text: decode(text) });
		} else if (close) {
			// Close the nearest open element of that tag, and anything left open
			// inside it; a stray closing tag closes nothing.
			const name = tag.toLowerCase();
			let at = stack.length - 1;
			while (at > 0 && stack[at].tag !== name) at--;
			if (at > 0) stack.length = at;
		} else {
			const el = {
				kind: "el" as const,
				tag: tag.toLowerCase(),
				attrs,
				children: [],
			};
			top.children.push(el);
			if (!VOID.has(el.tag) && !attrs.trimEnd().endsWith("/")) stack.push(el);
		}
	}
	return root.children;
};

const attr = (el: { attrs: string }, name: string) =>
	new RegExp(`${name}="([^"]*)"`).exec(el.attrs)?.[1];

const BLOCK = new Set([
	"p",
	"h1",
	"h2",
	"h3",
	"ul",
	"ol",
	"li",
	"pre",
	"blockquote",
	"details",
	"summary",
	"div",
	"hr",
	"img",
	"table",
]);

const textOf = (nodes: Node[]): string =>
	nodes.map((n) => (n.kind === "text" ? n.text : textOf(n.children))).join("");

const inline = (nodes: Node[]): string =>
	nodes
		.map((n) => {
			if (n.kind === "text") return n.text;
			const inner = inline(n.children);
			switch (n.tag) {
				case "strong":
				case "b":
					return `**${inner}**`;
				case "em":
				case "i":
					return `_${inner}_`;
				case "s":
				case "del":
					return `~~${inner}~~`;
				case "code":
					return `\`${textOf(n.children)}\``;
				case "a":
					return `[${inner}](${attr(n, "href") ?? ""})`;
				case "br":
					return "\n";
				default:
					return inner;
			}
		})
		.join("");

const isList = (n: Node): n is Node & { kind: "el" } =>
	n.kind === "el" && (n.tag === "ul" || n.tag === "ol");

/** A list item's content; the editor wraps a task item's in a `<div>`. */
const itemNodes = (li: Node & { kind: "el" }) =>
	li.children.flatMap((c) =>
		c.kind === "el" && c.tag === "div" ? c.children : [c],
	);

/** A list item's own text: everything but the lists nested in it. */
const itemText = (li: Node & { kind: "el" }) =>
	blocks(itemNodes(li).filter((c) => !isList(c)))
		.join(" ")
		.trim();

const list = (el: Node & { kind: "el" }, depth: number): string =>
	el.children
		.filter(
			(li): li is Node & { kind: "el" } => li.kind === "el" && li.tag === "li",
		)
		.map((li) => {
			const checked = attr(li, "data-checked");
			const marker =
				checked === undefined
					? el.tag === "ol"
						? "1."
						: "-"
					: `- [${checked === "true" ? "x" : " "}]`;
			const nested = itemNodes(li)
				.filter(isList)
				.map((sub) => `\n${list(sub, depth + 1)}`)
				.join("");
			return `${"  ".repeat(depth)}${marker} ${itemText(li)}${nested}`;
		})
		.join("\n");

/** Block-level markdown for a run of nodes, one entry per block. */
const blocks = (nodes: Node[]): string[] => {
	const out: string[] = [];
	let run: Node[] = [];
	const flush = () => {
		const text = inline(run).trim();
		if (text) out.push(text);
		run = [];
	};
	for (const n of nodes) {
		if (n.kind === "text" || !BLOCK.has(n.tag)) {
			run.push(n);
			continue;
		}
		flush();
		switch (n.tag) {
			case "h1":
			case "h2":
			case "h3":
				out.push(
					`${"#".repeat(Number(n.tag[1]))} ${inline(n.children).trim()}`,
				);
				break;
			case "ul":
			case "ol":
				out.push(list(n, 0));
				break;
			case "pre":
				out.push(`\`\`\`\n${textOf(n.children)}\n\`\`\``);
				break;
			case "blockquote":
				out.push(
					blocks(n.children)
						.join("\n\n")
						.split("\n")
						.map((l) => `> ${l}`)
						.join("\n"),
				);
				break;
			case "summary":
				out.push(`**${inline(n.children).trim()}**`);
				break;
			case "hr":
				out.push("---");
				break;
			case "img":
				out.push(`![](${attr(n, "src") ?? ""})`);
				break;
			default:
				out.push(...blocks(n.children));
		}
	}
	flush();
	return out;
};

export const htmlToMarkdown = (html: string) =>
	blocks(parse(html)).join("\n\n");

/**
 * Every to-do item in `html`, nested ones included, in document order: its own
 * text as markdown and whether it is ticked.
 */
export const todoItems = (html: string) => {
	const found: Array<{ text: string; checked: boolean }> = [];
	const walk = (nodes: Node[]) => {
		for (const n of nodes) {
			if (n.kind !== "el") continue;
			const checked = n.tag === "li" ? attr(n, "data-checked") : undefined;
			if (checked !== undefined)
				found.push({ text: itemText(n), checked: checked === "true" });
			walk(n.children);
		}
	};
	walk(parse(html));
	return found;
};

/**
 * `html` with its `n`th to-do item, counted as `todoItems` counts, ticked or
 * not, its own checkbox included; null when it has no such item.
 */
export const setTodoChecked = (html: string, n: number, checked: boolean) => {
	let seen = -1;
	let inItem = false;
	const out = html.replace(
		/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
		(tag, close: string, name: string, attrs: string) => {
			const el = name.toLowerCase();
			if (close) return tag;
			if (el === "li" && attr({ attrs }, "data-checked") !== undefined) {
				seen++;
				inItem = seen === n;
				return inItem
					? tag.replace(/data-checked="[^"]*"/, `data-checked="${checked}"`)
					: tag;
			}
			// The item's own checkbox is the first one after its tag.
			if (el === "input" && inItem && /type="checkbox"/.test(attrs)) {
				inItem = false;
				const bare = tag.replace(/\schecked(="[^"]*")?/, "");
				return checked ? bare.replace(/\s*\/?>$/, ' checked="checked">') : bare;
			}
			return tag;
		},
	);
	return seen >= n ? out : null;
};
