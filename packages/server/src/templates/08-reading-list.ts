import { h1, h2, p, type TemplateDef, TODO, UL } from "./_kit.js";

export default {
	id: "reading-list",
	title: "Reading List",
	icon: "📖",
	description: "Books and articles with status, rating, and notes pages.",
	blocks: [
		h1("Reading List 📖"),
		p(
			"Track what you want to read, what you're reading, and what you thought. Each book links to a notes page.",
		),
		{
			kind: "database",
			name: "Books",
			titleLabel: "Title",
			fields: [
				{ name: "Author", type: "text" },
				{
					name: "Status",
					type: "select",
					options: ["Want to read", "Reading", "Finished"],
				},
				{
					name: "Rating",
					type: "select",
					options: ["★", "★★", "★★★", "★★★★", "★★★★★"],
				},
				{ name: "Finished on", type: "date" },
				{ name: "Notes", type: "page" },
			],
			views: [
				{ name: "Library", type: "table" },
				{ name: "By status", type: "board", groupByFieldName: "Status" },
			],
			records: [
				{
					title: "Atomic Habits",
					values: {
						Author: "James Clear",
						Status: "Finished",
						Rating: "★★★★",
						"Finished on": "2026-09-30",
					},
					pageLinks: { Notes: "Notes: Atomic Habits" },
				},
				{
					title: "The Pragmatic Programmer",
					values: { Author: "Hunt & Thomas", Status: "Reading" },
					pageLinks: { Notes: "Notes: The Pragmatic Programmer" },
				},
				{
					title: "Deep Work",
					values: { Author: "Cal Newport", Status: "Want to read" },
				},
				{
					title: "Sapiens",
					values: {
						Author: "Yuval Noah Harari",
						Status: "Finished",
						Rating: "★★★★★",
						"Finished on": "2026-07-12",
					},
				},
				{
					title: "The Design of Everyday Things",
					values: { Author: "Don Norman", Status: "Want to read" },
				},
			],
		},
	],
	children: [
		{
			title: "Notes: Atomic Habits",
			icon: "📝",
			blocks: [
				h1("Notes: Atomic Habits 📝"),
				h2("Key ideas"),
				{
					kind: "block",
					type: "bulletList",
					content: UL([
						"Small habits compound: 1% better every day",
						"Focus on systems, not goals",
						"Make it obvious, attractive, easy, satisfying",
					]),
				},
				h2("What I'll try"),
				{
					kind: "block",
					type: "todo",
					content: TODO("Stack a 5-minute walk after morning coffee"),
				},
			],
		},
		{
			title: "Notes: The Pragmatic Programmer",
			icon: "📝",
			blocks: [
				h1("Notes: The Pragmatic Programmer 📝"),
				h2("Highlights"),
				{
					kind: "block",
					type: "bulletList",
					content: UL([
						"Don't repeat yourself",
						"Fix broken windows early",
						"Tracer bullets beat big up-front design",
					]),
				},
			],
		},
	],
} satisfies TemplateDef;
