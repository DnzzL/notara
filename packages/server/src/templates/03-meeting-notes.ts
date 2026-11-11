import { BULLET, CALLOUT, h1, h2, type TemplateDef, TODO } from "./_kit.js";

export default {
	id: "meeting-notes",
	title: "Meeting Notes",
	icon: "📋",
	description: "Agenda, discussion notes, decisions, and action items.",
	blocks: [
		h1("Meeting Notes 📋"),
		{
			kind: "block",
			type: "callout",
			content: CALLOUT(
				"📅 Meeting info",
				"Date: &nbsp; · &nbsp; Participants: &nbsp; · &nbsp; Duration:",
			),
		},
		h2("Agenda"),
		{ kind: "block", type: "bulletList", content: BULLET("Item 1") },
		{ kind: "block", type: "bulletList", content: BULLET("Item 2") },
		{ kind: "block", type: "bulletList", content: BULLET("Item 3") },
		h2("Discussion Notes"),
		{ kind: "block", type: "paragraph", content: "<p></p>" },
		{ kind: "block", type: "divider", content: "" },
		h2("Decisions"),
		{
			kind: "block",
			type: "callout",
			content: CALLOUT(
				"No decisions recorded yet.",
				"Add key decisions here as the meeting progresses.",
			),
		},
		h2("Action Items"),
		{ kind: "block", type: "todo", content: TODO("Follow up on…") },
		{ kind: "block", type: "todo", content: TODO("Send summary to team") },
		{ kind: "block", type: "todo", content: TODO("Schedule next meeting") },
	],
} satisfies TemplateDef;
