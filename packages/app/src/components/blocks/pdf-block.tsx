import { useState } from "react";
import type { BlockRendererProps } from "./renderer-registry.js";
import { tryParseBlockContent } from "./renderer-registry.js";

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfBlock({ block }: BlockRendererProps) {
	let src: string | null = null;
	let fileName = "document.pdf";
	let fileSize: number | null = null;

	const data = tryParseBlockContent<{
		src: string;
		fileName?: string;
		size?: number;
	}>(block.content ?? "");
	if (data) {
		src = data.src;
		fileName = data.fileName || fileName;
		fileSize = data.size ?? null;
	}

	const [previewOpen, setPreviewOpen] = useState(false);

	if (!src) {
		return <div className="block-image-placeholder">PDF not found</div>;
	}

	return (
		<div className="block-pdf">
			<div className="block-pdf-card">
				<span className="block-pdf-card-icon">📄</span>
				<div className="block-pdf-card-info">
					<span className="block-pdf-card-name">{fileName}</span>
					{fileSize !== null && (
						<span className="block-pdf-card-size">{formatSize(fileSize)}</span>
					)}
				</div>
				<div className="block-pdf-card-actions">
					<button
						className="block-pdf-card-btn"
						onClick={() => setPreviewOpen((v) => !v)}
					>
						{previewOpen ? "Hide preview" : "Preview"}
					</button>
					<a
						href={src}
						target="_blank"
						rel="noopener noreferrer"
						className="block-pdf-card-btn"
					>
						Open
					</a>
				</div>
			</div>
			{previewOpen && (
				<iframe src={src} title={fileName} className="block-pdf-frame" />
			)}
		</div>
	);
}
