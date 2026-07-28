import type { BlockRendererProps } from "./renderer-registry.js";
import { tryParseBlockContent } from "./renderer-registry.js";

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(fileName: string): string {
	const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
	const iconMap: Record<string, string> = {
		pdf: "\uD83D\uDCC4",
		doc: "\uD83D\uDCDD",
		docx: "\uD83D\uDCDD",
		xls: "\uD83D\uDCCA",
		xlsx: "\uD83D\uDCCA",
		csv: "\uD83D\uDCCA",
		zip: "\uD83D\uDCE6",
		gz: "\uD83D\uDCE6",
		tar: "\uD83D\uDCE6",
		rar: "\uD83D\uDCE6",
		mp3: "\uD83C\uDFB5",
		wav: "\uD83C\uDFB5",
		mp4: "\uD83C\uDFAC",
		mov: "\uD83C\uDFAC",
		avi: "\uD83C\uDFAC",
		ppt: "\uD83D\uDCCA",
		pptx: "\uD83D\uDCCA",
		json: "{ }",
		txt: "\uD83D\uDCDD",
	};
	return iconMap[ext] || "\uD83D\uDCCE";
}

export function FileBlock({ block }: BlockRendererProps) {
	let src: string | null = null;
	let fileName = "file";
	let fileSize: number | null = null;
	let _mimeType = "";

	const data = tryParseBlockContent<{
		src: string;
		fileName?: string;
		size?: number;
		mimeType?: string;
	}>(block.content ?? "");
	if (data) {
		src = data.src;
		fileName = data.fileName || fileName;
		fileSize = data.size ?? null;
		_mimeType = data.mimeType || "";
	}

	if (!src) {
		return <div className="block-file-placeholder">File not found</div>;
	}

	return (
		<div className="block-file">
			<span className="block-file-icon">{fileIcon(fileName)}</span>
			<div className="block-file-info">
				<span className="block-file-name">{fileName}</span>
				{fileSize !== null && (
					<span className="block-file-size">{formatSize(fileSize)}</span>
				)}
			</div>
			<a
				href={src}
				download={fileName}
				className="block-file-download"
				target="_blank"
				rel="noopener noreferrer"
			>
				Download
			</a>
		</div>
	);
}
