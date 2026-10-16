/**
 * The agent loop the landing page shows as proof (NOT-174): one card's cycle,
 * in the calls an agent makes for it. This module is the single source for both
 * the render and `test/landing-loop.test.ts`, which checks every call here
 * against what `/llms.txt` documents — a landing that quotes a call the product
 * does not have teaches the wrong loop.
 */

/** One REST call: its method and its workspace-relative path, placeholders and all. */
type LoopCall = {
	method: "GET" | "PUT" | "POST";
	path: string;
};

/** One beat of the cycle: the call(s) it takes and what they do. */
export type LoopStep = {
	calls: LoopCall[];
	desc: string;
};

export const loopSteps: LoopStep[] = [
	{
		calls: [
			{
				method: "GET",
				path: "/databases/<dbId>/records?field=Status&value=ready-for-agent",
			},
		],
		desc: "Find work — every card whose Status is ready-for-agent.",
	},
	{
		calls: [{ method: "GET", path: "/databases/<dbId>/records/NOT-12" }],
		desc: "Read the card — its fields, its page as markdown, its acceptance criteria.",
	},
	{
		calls: [
			{
				method: "PUT",
				path: "/databases/<dbId>/records/NOT-12/criteria/<criterionId>",
			},
			{ method: "POST", path: "/databases/<dbId>/records/NOT-12/comments" },
		],
		desc: "Tick what is done, ask what is not — the comment lands in a teammate's inbox.",
	},
];
