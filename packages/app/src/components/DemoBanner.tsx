import { useState } from "react";

/**
 * Strip shown at the top of a demo workspace so the visitor knows the data is
 * temporary. Dismissible for the current view; it comes back on reload, which is
 * the point — the workspace really does disappear.
 */
export function DemoBanner() {
	const [dismissed, setDismissed] = useState(false);
	if (dismissed) return null;

	return (
		<div className="demo-banner">
			<span>
				You're in a <strong>temporary demo workspace</strong>. It's wiped
				automatically, so don't keep anything you need here.
			</span>
			<button
				type="button"
				className="demo-banner-dismiss"
				onClick={() => setDismissed(true)}
				aria-label="Dismiss demo notice"
			>
				×
			</button>
		</div>
	);
}
