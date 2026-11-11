import {
	AbsoluteFill,
	Easing,
	interpolate,
	OffthreadVideo,
	Sequence,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { AGENT_CLICKS, CLICKS } from "./clicks";
import { Cursor } from "./Cursor";

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
 *   → the same records, as a board
 *   → a new page from a template   Reading List, ready-made
 *   → an agent writes into it      over the API, live, in the open page
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
type Timeline = readonly { t: number; shot: Shot }[];

const TIMELINE: Timeline = [
	{ t: 0.0, shot: WIDE },
	{ t: 0.5, shot: WIDE },
	{ t: 1.0, shot: PAGE }, // settled before the link is clicked at 1.14
	{ t: 2.4, shot: PAGE }, // the click, and the redirect
	{ t: 3.4, shot: BRIEF }, // down the brief; its backlink is clicked at 3.77
	{ t: 5.2, shot: BRIEF },
	{ t: 5.7, shot: WIDE }, // out, so the sidebar click at 5.82 is on screen
	{ t: 6.9, shot: WIDE },
	{ t: 10.2, shot: DB }, // in over the scroll; Board is clicked at 10.66
	{ t: 12.3, shot: DB }, // the board, close enough to read a card
	{ t: 13.4, shot: WIDE }, // out — but still on the board, which is the last
	{ t: 13.9, shot: WIDE }, // thing you see, and the note the loop ends on
];

/** The agent beat, against its own capture. Wide for the picker, then in on
 *  the page, so the note the agent writes is readable when it lands (~4.2s). */
const AGENT_TIMELINE: Timeline = [
	{ t: 0.0, shot: WIDE },
	{ t: 2.7, shot: WIDE },
	{ t: 3.5, shot: PAGE },
	{ t: 6.2, shot: PAGE },
];

/**
 * The cut list. Each clip plays `dur` seconds of a capture from `from`, with
 * the camera and click track written against that capture's own clock.
 *
 * The first capture is the tracker story, trimmed: the sidebar trip and the
 * scroll to the table are cut to keep the loop short. The second is a fresh
 * recording of the agent beat.
 */
type Clip = {
	file: string;
	from: number;
	dur: number;
	timeline: Timeline;
	clicks: typeof CLICKS;
};

const CLIPS: readonly Clip[] = [
	{ file: "capture.webm", from: 0, dur: 5.0, timeline: TIMELINE, clicks: CLICKS },
	{
		file: "capture.webm",
		from: 10.0,
		dur: 2.8,
		timeline: TIMELINE,
		clicks: CLICKS.filter((c) => c.label === "board"),
	},
	{
		file: "agent.webm",
		from: 0,
		dur: 6.2,
		timeline: AGENT_TIMELINE,
		clicks: AGENT_CLICKS,
	},
];

export const DURATION = CLIPS.reduce((n, c) => n + c.dur, 0);

const EASE = Easing.bezier(0.32, 0, 0.16, 1);

function shotAt(TIMELINE: Timeline, t: number): Shot {
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

function ClipView({ clip }: { clip: Clip }) {
	const frame = useCurrentFrame();
	const { fps, width } = useVideoConfig();

	// Local to the Sequence: 0 is the clip's first frame, `from` its place in the capture.
	const t = clip.from + frame / fps;
	const shot = shotAt(clip.timeline, t);
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
					src={staticFile(clip.file)}
					startFrom={Math.round(clip.from * fps)}
					style={{ width: SRC_W, height: SRC_H, display: "block" }}
					muted
				/>
			</div>
			<Cursor clicks={clip.clicks} t={t} shot={shot} scale={scale} />
		</AbsoluteFill>
	);
}

export function Hero() {
	const { fps } = useVideoConfig();
	let at = 0;
	return (
		<AbsoluteFill style={{ backgroundColor: "#FAFAF8" }}>
			{CLIPS.map((clip) => {
				const from = Math.round(at * fps);
				at += clip.dur;
				return (
					<Sequence
						key={`${clip.file}-${clip.from}`}
						from={from}
						durationInFrames={Math.round(clip.dur * fps)}
					>
						<ClipView clip={clip} />
					</Sequence>
				);
			})}
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
