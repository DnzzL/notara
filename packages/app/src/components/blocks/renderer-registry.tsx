import type React from "react";
import type { Block } from "@notara/shared";

/**
 * BlockRenderer interface — each block type implements this.
 * Used by SingleBlockEditor to render non-TipTap block types
 * (divider, image, pdf).
 */
export interface BlockRendererProps {
	block: Block;
	blockIndex: number;
	totalBlocks: number;
	onUpdateBlock: (id: string, content: string) => Promise<void>;
	onDeleteBlock: (id: string) => Promise<void>;
}

/**
 * Parse block content that may be wrapped in HTML tags (e.g. from TipTap).
 * Tries JSON parse directly first, then strips HTML and retries.
 */
export function tryParseBlockContent<T>(content: string): T | null {
	if (content.startsWith("{")) {
		try {
			return JSON.parse(content) as T;
		} catch {
			/* fall through */
		}
	}
	// Handle <p>{...}</p> wrapping from TipTap
	const stripped = content.replace(/<[^>]*>/g, "").trim();
	if (stripped.startsWith("{")) {
		try {
			return JSON.parse(stripped) as T;
		} catch {
			/* fall through */
		}
	}
	return null;
}

// ── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, React.ComponentType<BlockRendererProps>>();

export function registerBlockRenderer(
	type: Block["type"],
	component: React.ComponentType<BlockRendererProps>,
) {
	registry.set(type, component);
}

export function getBlockRenderer(
	type: string,
): React.ComponentType<BlockRendererProps> | undefined {
	return registry.get(type);
}

export function hasBlockRenderer(type: string): boolean {
	return registry.has(type);
}

// ── Import and register all built-in renderers ──────────────────────────────

import { DividerBlock } from "./divider-block.js";
import { ImageBlock } from "./image-block.js";
import { PdfBlock } from "./pdf-block.js";
import { FileBlock } from "./file-block.js";
import { PeopleBlock } from "./people-block.js";
import { ViewReferenceBlock } from "./view-reference-block.js";

registerBlockRenderer("divider", DividerBlock);
registerBlockRenderer("image", ImageBlock);
registerBlockRenderer("pdf", PdfBlock);
registerBlockRenderer("file", FileBlock);
registerBlockRenderer("people", PeopleBlock);
registerBlockRenderer("viewReference", ViewReferenceBlock);
