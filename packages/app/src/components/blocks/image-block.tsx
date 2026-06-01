import type { BlockRendererProps } from "./renderer-registry.js";

export function ImageBlock({ block }: BlockRendererProps) {
  let src: string | null = null;
  let alt = "Block image";

  if (block.content?.startsWith("{")) {
    try {
      const data = JSON.parse(block.content);
      src = data.src;
      alt = data.fileName || alt;
    } catch { /* fall through */ }
  }
  if (!src) {
    // Legacy HTML format
    const srcMatch = block.content?.match(/src=["']([^"']+)["']/);
    if (srcMatch) src = srcMatch[1];
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="block-image"
        style={{ maxWidth: "100%", borderRadius: 4, display: "block", margin: "4px 0" }}
      />
    );
  }
  return <div className="block-image-placeholder">Click to add image</div>;
}
