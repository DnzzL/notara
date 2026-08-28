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
 * Two reading windows, because the two things worth reading want different
 * framings. The content column is 1035 CSS px wide (measured, not guessed):
 * anything narrower than that clips headings, which looks broken rather than
 * cropped.
 *
 * PAGE holds the whole column — headings, prose, the sub-page link — at 0.65x.
 * DB drops the column's right edge to buy back size on the table rows, which
 * are set in 13px and need it.
 */
const PAGE = { x: 680, y: 60, w: 2140, h: 1219 };
const DB = { x: 700, y: 560, w: 1720, h: 980 };

/**
 * Beats in the trimmed capture, in seconds. The page scrolls from the top of
 * the document down to the databases, the view switches to a board and back,
 * then the page scrolls home.
 */
const BEATS = {
	scrollDown: 2.5,
	toBoard: 4.4,
	toTable: 7.7,
	scrollUp: 9.9,
	end: 12.9,
};

type Window = { x: number; y: number; w: number; h: number };

const EASE = Easing.bezier(0.32, 0, 0.16, 1);

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

	// Three moves, timed to the capture:
	//   in    — from the whole product to the page, before anything scrolls
	//   slide — from the page to the table, riding the scroll that reveals it
	//   out   — back to the whole product, after the page comes home, so the
	//           last frame matches the first and the loop has no seam
	const zoomIn = interpolate(t, [0.9, 2.1], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: EASE,
	});
	const slide = interpolate(
		t,
		[BEATS.scrollDown + 0.4, BEATS.toBoard - 0.3],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
	);
	const zoomOut = interpolate(
		t,
		[BEATS.scrollUp + 0.8, BEATS.end - 0.4],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
	);

	const reading = lerpWindow(PAGE, DB, slide);
	const win = lerpWindow(lerpWindow(WIDE, reading, zoomIn), WIDE, zoomOut);
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
