import React from "react";
import type { Block } from "@notion-alt/shared";

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

// ── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, React.ComponentType<BlockRendererProps>>();

export function registerBlockRenderer(type: Block["type"], component: React.ComponentType<BlockRendererProps>) {
  registry.set(type, component);
}

export function getBlockRenderer(type: string): React.ComponentType<BlockRendererProps> | undefined {
  return registry.get(type);
}

export function hasBlockRenderer(type: string): boolean {
  return registry.has(type);
}

// ── Import and register all built-in renderers ──────────────────────────────

import { DividerBlock } from "./divider-block.js";
import { ImageBlock } from "./image-block.js";
import { PdfBlock } from "./pdf-block.js";

registerBlockRenderer("divider", DividerBlock);
registerBlockRenderer("image", ImageBlock);
registerBlockRenderer("pdf", PdfBlock);
