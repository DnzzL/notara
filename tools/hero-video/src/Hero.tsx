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
 * ## The story
 *
 * Not a feature tour. One believable minute of someone's Tuesday, where each
 * step causes the next:
 *
 *   "Where's the spec for this?"   a tracker page links to a brief
 *   → follow the link              the app navigates, the sidebar follows
 *   → the brief is a real page     Goal, Scope, Milestones — not a stub
 *   → it knows who links to it     one backlink, pointing home
 *   → back to the tracker          via the sidebar, which kept its place
 *   → the same records, as a board
 *
 * The point is that everything is connected — the thing a screenshot cannot
 * say and a feature list does not make anyone believe.
 *
 * ## The camera
 *
 * This renders at 693x395 on the landing page. A frame wide enough to show the
 * product puts the app's 13px text under 6px; a frame tight enough to read
 * shows a fragment. So the camera moves: wide to establish, in to read, out to
 * close the loop on the frame it opened with.
 *
 * It is a *window* over the source, not a CSS scale — the capture is 2880x1640
 * (deviceScaleFactor 2), so even the tightest shot oversamples the 693px slot
 * rather than upscaling into it.
 */

const SRC_W = 2880;
const SRC_H = 1640;

type Shot = { x: number; y: number; w: number; h: number };

/** The whole product: sidebar, page tree, page. Establishes and closes. */
const WIDE: Shot = { x: 0, y: 0, w: SRC_W, h: SRC_H };

/**
 * The content column is 1035 CSS px wide — measured from the DOM, not guessed.
 * Anything narrower clips headings, which reads as broken rather than cropped.
 */
const PAGE: Shot = { x: 680, y: 60, w: 2140, h: 1219 };

/** The same column, further down, so the brief's body and its backlink footer
 *  are in one frame. */
const BRIEF: Shot = { x: 680, y: 400, w: 2140, h: 1219 };

/** Tighter: the table is set in 13px and needs the size the column's right
 *  edge was spending. */
const DB: Shot = { x: 700, y: 560, w: 1720, h: 980 };

/**
 * Camera keyframes, in seconds against the trimmed capture. Between two
 * keyframes the shot is interpolated; two keyframes with the same shot are a
 * hold. Every move lands *before* the thing it is there to show.
 */
const TIMELINE: readonly { t: number; shot: Shot }[] = [
	{ t: 0.0, shot: WIDE },
	{ t: 1.0, shot: WIDE },
	{ t: 2.2, shot: PAGE }, // in, while the link is still unclicked
	{ t: 3.4, shot: PAGE }, // the click, and the redirect
	{ t: 5.0, shot: BRIEF }, // drift down the brief to its backlink footer
	{ t: 8.8, shot: BRIEF }, // the backlink expands here
	{ t: 10.2, shot: PAGE }, // back on the tracker
	{ t: 12.4, shot: DB }, // ride the scroll down to the databases
	{ t: 17.6, shot: DB }, // table, board, table
	{ t: 18.9, shot: WIDE }, // out
	{ t: 19.9, shot: WIDE },
];

const EASE = Easing.bezier(0.32, 0, 0.16, 1);

function shotAt(t: number): Shot {
	const last = TIMELINE.length - 1;
	const first = TIMELINE[0];
	const final = TIMELINE[last];
	if (!first || !final) throw new Error("TIMELINE must not be empty");
	if (t <= first.t) return first.shot;
	if (t >= final.t) return final.shot;

	let i = 0;
	while (i < last && (TIMELINE[i + 1]?.t ?? Infinity) <= t) i++;
	const a = TIMELINE[i];
	const b = TIMELINE[i + 1];
	if (!a || !b) return final.shot;

	const p = interpolate(t, [a.t, b.t], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: EASE,
	});
	return {
		x: a.shot.x + (b.shot.x - a.shot.x) * p,
		y: a.shot.y + (b.shot.y - a.shot.y) * p,
		w: a.shot.w + (b.shot.w - a.shot.w) * p,
		h: a.shot.h + (b.shot.h - a.shot.h) * p,
	};
}

export function Hero() {
	const frame = useCurrentFrame();
	const { fps, width } = useVideoConfig();

	const shot = shotAt(frame / fps);
	const scale = width / shot.w;

	return (
		<AbsoluteFill style={{ backgroundColor: "#FAFAF8", overflow: "hidden" }}>
			<div
				style={{
					position: "absolute",
					width: SRC_W,
					height: SRC_H,
					transform: `scale(${scale}) translate(${-shot.x}px, ${-shot.y}px)`,
					transformOrigin: "top left",
				}}
			>
				<OffthreadVideo
					src={staticFile("capture.webm")}
					style={{ width: SRC_W, height: SRC_H, display: "block" }}
					muted
				/>
			</div>
			{/* The landing page shows this in a rounded 8px window; a hairline keeps
			    the paper background of the capture from bleeding into the paper
			    background of the page. */}
			<AbsoluteFill
				style={{
					boxShadow: "inset 0 0 0 1px rgba(10,10,10,0.10)",
					pointerEvents: "none",
				}}
			/>
		</AbsoluteFill>
	);
}
