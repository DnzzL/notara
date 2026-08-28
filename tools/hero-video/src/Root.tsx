import { Composition } from "remotion";
import { Hero } from "./Hero";

/** 1288x734 is ~1.86x the 693x395 the landing page renders it at. */
export function RemotionRoot() {
	return (
		<Composition
			id="Hero"
			component={Hero}
			durationInFrames={Math.round(12.9 * 30)}
			fps={30}
			width={1288}
			height={734}
		/>
	);
}
