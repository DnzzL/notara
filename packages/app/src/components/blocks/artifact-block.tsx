import { useRef } from "react";
import type { BlockRendererProps } from "./renderer-registry.js";
import { tryParseBlockContent } from "./renderer-registry.js";

/**
 * An artifact (ADR-013): a self-contained HTML document shown live. Its frame
 * has an opaque origin — scripts run, but nothing reaches the network, this
 * page or the reader's session — and its links open in a new tab.
 */
export function ArtifactBlock({ block }: BlockRendererProps) {
	const frame = useRef<HTMLDivElement>(null);
	const data = tryParseBlockContent<{
		src: string;
		fileName?: string;
		blockedHosts?: string[];
	}>(block.content ?? "");

	if (!data?.src)
		return <div className="block-file-placeholder">Artifact not found</div>;

	const name = data.fileName || "artifact.html";
	const blocked = data.blockedHosts ?? [];

	return (
		<div className="block-artifact">
			<div className="block-pdf-card">
				<span className="block-pdf-card-icon" aria-hidden="true">
					⧉
				</span>
				<div className="block-pdf-card-info">
					<span className="block-pdf-card-name">{name}</span>
					<span
						className="block-pdf-card-size"
						title={
							blocked.length > 0
								? `Not loaded: ${blocked.join(", ")}`
								: undefined
						}
					>
						Isolated: no network, no access to this page
						{blocked.length > 0 && ` · ${blocked.length} host(s) blocked`}
					</span>
				</div>
				<div className="block-pdf-card-actions">
					<button
						type="button"
						className="block-pdf-card-btn"
						onClick={() => frame.current?.requestFullscreen()}
					>
						Full screen
					</button>
					<a
						href={data.src}
						target="_blank"
						rel="noopener noreferrer"
						className="block-pdf-card-btn"
					>
						Open
					</a>
				</div>
			</div>
			<div ref={frame} className="block-artifact-frame">
				{/* Attaching again replaces the file under the same URL: remount to reload it. */}
				<iframe
					key={block.content}
					src={data.src}
					title={name}
					sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
				/>
			</div>
		</div>
	);
}
