import type { BlockRendererProps } from "./renderer-registry.js";

export function PdfBlock({ block }: BlockRendererProps) {
  let src: string | null = null;
  let fileName = "document.pdf";

  if (block.content?.startsWith("{")) {
    try {
      const data = JSON.parse(block.content);
      src = data.src;
      fileName = data.fileName || fileName;
    } catch { /* fall through */ }
  }

  if (!src) {
    return <div className="block-image-placeholder">PDF not found</div>;
  }

  return (
    <div className="block-pdf">
      <div className="block-pdf-header">
        <span>📄 {fileName}</span>
        <a href={src} target="_blank" rel="noopener noreferrer">Open</a>
      </div>
      <iframe src={src} title={fileName} className="block-pdf-frame" />
    </div>
  );
}
