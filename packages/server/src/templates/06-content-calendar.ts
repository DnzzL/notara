import { h1, p, type TemplateDef } from "./_kit.js";

export default {
	id: "content-calendar",
	title: "Content Calendar",
	icon: "🗓️",
	description: "Plan posts from idea to published, with publish dates.",
	blocks: [
		h1("Content Calendar 🗓️"),
		p(
			"Capture ideas, draft them, and schedule publishing. The <strong>Board</strong> view follows each piece from idea to published.",
		),
		{
			kind: "database",
			name: "Content",
			titleLabel: "Title",
			fields: [
				{
					name: "Status",
					type: "select",
					options: ["Idea", "Drafting", "Scheduled", "Published"],
				},
				{
					name: "Channel",
					type: "select",
					options: ["Blog", "Newsletter", "LinkedIn", "YouTube"],
				},
				{ name: "Publish date", type: "date" },
				{ name: "Author", type: "text" },
			],
			views: [
				{ name: "Calendar list", type: "table" },
				{ name: "Pipeline", type: "board", groupByFieldName: "Status" },
			],
			records: [
				{
					title: "10 lessons from our first year",
					values: {
						Status: "Published",
						Channel: "Blog",
						"Publish date": "2026-10-15",
						Author: "Alex",
					},
				},
				{
					title: "Behind the scenes: how we plan a launch",
					values: {
						Status: "Scheduled",
						Channel: "Newsletter",
						"Publish date": "2026-11-18",
						Author: "Sam",
					},
				},
				{
					title: "Customer story: Atelier Lumière",
					values: {
						Status: "Drafting",
						Channel: "Blog",
						"Publish date": "2026-11-25",
						Author: "Jordan",
					},
				},
				{
					title: "5-minute product tour",
					values: { Status: "Drafting", Channel: "YouTube", Author: "Alex" },
				},
				{
					title: "Year-end recap thread",
					values: { Status: "Idea", Channel: "LinkedIn", Author: "Sam" },
				},
				{
					title: "FAQ: your top questions answered",
					values: { Status: "Idea", Channel: "Blog" },
				},
			],
		},
	],
} satisfies TemplateDef;
