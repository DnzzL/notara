/**
 * Where and when the pointer clicks, in *source* pixels (the capture is
 * 2880x1640) and seconds against the trimmed capture.
 *
 * Logged during the recording rather than eyeballed afterwards: each target's
 * bounding box was read from the DOM immediately before its click. A CDP
 * screencast does not capture the mouse, so without this the video shows
 * effects with no visible cause — things change and the viewer cannot tell why.
 */
export type Click = { t: number; x: number; y: number; label: string };

/** 0.6s of lead-in was trimmed off the capture; these are already adjusted. */
export const CLICKS: readonly Click[] = [
	{ t: 1.14, x: 848, y: 675, label: "link" },
	{ t: 3.74, x: 1701, y: 1534, label: "backlink" },
	{ t: 5.78, x: 284, y: 380, label: "sidebar" },
	{ t: 9.70, x: 1054, y: 656, label: "board" },
];
