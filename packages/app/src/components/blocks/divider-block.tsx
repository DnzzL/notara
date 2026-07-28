import type { BlockRendererProps } from "./renderer-registry.js";

export function DividerBlock(_props: BlockRendererProps) {
	return <hr className="block-divider" />;
}
