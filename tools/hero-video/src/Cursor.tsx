import { Easing, interpolate } from "remotion";
import type { Click } from "./clicks";

/**
 * A synthetic pointer.
 *
 * A CDP screencast does not capture the mouse, so the raw recording shows
 * effects with no visible cause: a page changes and the viewer cannot tell
 * what was clicked, or that anything was clicked at all. This draws the
 * pointer back in from the click track logged during the recording.
 *
 * It arrives at each target slightly *before* the click — anticipation is what
 * makes the click read as caused rather than coincidental — and pulses a ring
 * on contact.
 */

/** How long the pointer takes to travel between targets. */
const TRAVEL = 0.55;
/** It must be parked on the target before the click, not arriving with it. */
const SETTLE = 0.18;
/** How long the click ring lives. */
const RING = 0.45;

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

function positionAt(clicks: readonly Click[], t: number) {
	const first = clicks[0];
	if (!first) return null;

	// Before the first target: park on it rather than fly in from a corner,
	// which would draw the eye away from the establishing shot.
	if (t <= first.t - TRAVEL - SETTLE) return { x: first.x, y: first.y };

	let from = first;
	let to = first;
	for (let i = 0; i < clicks.length; i++) {
		const c = clicks[i];
		if (!c) continue;
		if (t >= c.t) {
			from = c;
			to = clicks[i + 1] ?? c;
		}
	}
	if (from === to) return { x: from.x, y: from.y };

	const start = to.t - TRAVEL - SETTLE;
	const p = interpolate(t, [start, start + TRAVEL], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: EASE,
	});
	return {
		x: from.x + (to.x - from.x) * p,
		y: from.y + (to.y - from.y) * p,
	};
}

export function Cursor({
	clicks,
	t,
	shot,
	scale,
}: {
	clicks: readonly Click[];
	t: number;
	/** The camera window, so source pixels can be mapped to screen pixels. */
	shot: { x: number; y: number };
	scale: number;
}) {
	const pos = positionAt(clicks, t);
	if (!pos) return null;

	// Screen space, not source space: a pointer is a constant size on screen no
	// matter how far the camera has pushed in.
	const left = (pos.x - shot.x) * scale;
	const top = (pos.y - shot.y) * scale;

	const active = clicks.find((c) => t >= c.t && t < c.t + RING);
	const ring = active
		? interpolate(t, [active.t, active.t + RING], [0, 1], {
				extrapolateRight: "clamp",
				easing: Easing.out(Easing.quad),
			})
		: null;

	return (
		<>
			{ring !== null && (
				<div
					style={{
						position: "absolute",
						left,
						top,
						width: 18 + ring * 46,
						height: 18 + ring * 46,
						marginLeft: -(18 + ring * 46) / 2,
						marginTop: -(18 + ring * 46) / 2,
						borderRadius: "50%",
						border: "2px solid #2B4DFF",
						opacity: (1 - ring) * 0.85,
						pointerEvents: "none",
					}}
				/>
			)}
			<svg
				width="26"
				height="30"
				viewBox="0 0 26 30"
				style={{
					position: "absolute",
					left,
					top,
					// The hotspot is the arrow tip, not the box corner.
					marginLeft: -3,
					marginTop: -2,
					filter: "drop-shadow(0 2px 4px rgba(10,10,10,0.35))",
					pointerEvents: "none",
				}}
				aria-hidden
			>
				<title>pointer</title>
				<path
					d="M4 2 L4 22 L9.5 17 L13 25.5 L17 24 L13.5 15.5 L20.5 15.5 Z"
					fill="#0A0A0A"
					stroke="#FFFFFF"
					strokeWidth="1.6"
					strokeLinejoin="round"
				/>
			</svg>
		</>
	);
}
