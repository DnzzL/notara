import {
	AbsoluteFill,
	Easing,
	interpolate,
	OffthreadVideo,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

/**
 * The landing-page hero.
 *
 * The problem this solves: the video is shown at 693x395 on the landing page.
 * A frame wide enough to show the product — sidebar, page, two databases — puts
 * the app's 13px body text under 6px on screen, and a frame tight enough to
 * read shows a fragment of a table and nothing that says "workspace".
 *
 * So it does both, in time. It opens on the whole product, pushes into the
 * database while the record list is on screen, holds through a switch to the
 * board, then pulls back out so the last frame matches the first and the loop
 * has no seam.
 *
 * The move is a *window* over the source, not a CSS scale of the whole frame:
 * the capture is 2880x1640 (deviceScaleFactor 2), so even the tightest window
 * still oversamples the 693px slot rather than upscaling into it.
 */

/** Source capture, 2880x1640. */
const SRC_W = 2880;
const SRC_H = 1640;

/** The whole product. */
const WIDE = { x: 0, y: 0, w: SRC_W, h: SRC_H };

/**
 * The database, cropped to what stays legible at 693px: task names, status,
 * priority, assignee. Derived from the live DOM, in CSS px x2 — the toolbar
 * sits at x=361 y=300 and the status line ends at x=1392 y=753.
 */
const TIGHT = { x: 740, y: 600, w: 1600, h: 912 };

/**
 * Beats in the trimmed capture, in seconds. The push lands just before the
 * board appears, so the switch happens close up where you can read it, and the
 * pull-back starts after the table returns so the loop closes on itself.
 */
const BEATS = { toBoard: 2.4, toTable: 5.9, end: 8.4 };

type Window = { x: number; y: number; w: number; h: number };

function lerpWindow(a: Window, b: Window, t: number): Window {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		w: a.w + (b.w - a.w) * t,
		h: a.h + (b.h - a.h) * t,
	};
}

export function Hero() {
	const frame = useCurrentFrame();
	const { fps, width } = useVideoConfig();
	const t = frame / fps;

	// Push in while the table is on screen, hold through the board, pull back
	// out in time to land on the opening frame.
	const push = interpolate(t, [0.9, 2.2], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: Easing.bezier(0.32, 0, 0.16, 1),
	});
	const pull = interpolate(t, [BEATS.toTable + 0.9, BEATS.end - 0.3], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: Easing.bezier(0.32, 0, 0.16, 1),
	});

	const win = lerpWindow(
		lerpWindow(WIDE, TIGHT, push),
		WIDE,
		pull,
	);

	// Render the window by scaling the source up and offsetting it, so the
	// browser resamples once, at the end, instead of per-layer.
	const scale = width / win.w;

	return (
		<AbsoluteFill style={{ backgroundColor: "#FAFAF8", overflow: "hidden" }}>
			<div
				style={{
					position: "absolute",
					width: SRC_W,
					height: SRC_H,
					transform: `scale(${scale}) translate(${-win.x}px, ${-win.y}px)`,
					transformOrigin: "top left",
				}}
			>
				<OffthreadVideo
					src={staticFile("capture.webm")}
					style={{ width: SRC_W, height: SRC_H, display: "block" }}
					// The capture is 10fps; let Remotion hold frames rather than
					// blend them, so text edges stay crisp.
					muted
				/>
			</div>
			{/* A hairline keeps the video from bleeding into the page background
			    on the landing, where it sits in a rounded 8px window. */}
			<AbsoluteFill
				style={{
					boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.10)",
					pointerEvents: "none",
				}}
			/>
		</AbsoluteFill>
	);
}
