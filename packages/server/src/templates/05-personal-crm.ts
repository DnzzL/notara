import { h1, p, type TemplateDef } from "./_kit.js";

export default {
	id: "personal-crm",
	title: "Personal CRM",
	icon: "🤝",
	description: "Keep in touch with people: last contact, next follow-up.",
	blocks: [
		h1("Personal CRM 🤝"),
		p(
			"Never lose touch with the people who matter. Switch to the <strong>Board</strong> view to see who needs a nudge.",
		),
		{
			kind: "database",
			name: "Contacts",
			titleLabel: "Name",
			fields: [
				{
					name: "Stage",
					type: "select",
					options: ["New", "Active", "Needs follow-up", "Dormant"],
				},
				{ name: "Company", type: "text" },
				{ name: "Email", type: "text" },
				{ name: "Last contact", type: "date" },
				{ name: "Next follow-up", type: "date" },
			],
			views: [
				{ name: "All contacts", type: "table" },
				{ name: "By stage", type: "board", groupByFieldName: "Stage" },
			],
			records: [
				{
					title: "Camille Dupont",
					values: {
						Stage: "Active",
						Company: "Atelier Lumière",
						Email: "camille@example.com",
						"Last contact": "2026-10-28",
						"Next follow-up": "2026-11-25",
					},
				},
				{
					title: "Marcus Webb",
					values: {
						Stage: "Needs follow-up",
						Company: "Webb & Sons",
						Email: "marcus@example.com",
						"Last contact": "2026-09-14",
						"Next follow-up": "2026-11-12",
					},
				},
				{
					title: "Aiko Tanaka",
					values: {
						Stage: "New",
						Company: "Studio Kumo",
						Email: "aiko@example.com",
						"Last contact": "2026-11-05",
						"Next follow-up": "2026-11-19",
					},
				},
				{
					title: "Priya Nair",
					values: {
						Stage: "Active",
						Company: "Greenleaf Café",
						Email: "priya@example.com",
						"Last contact": "2026-11-02",
						"Next follow-up": "2026-12-02",
					},
				},
				{
					title: "Tom Becker",
					values: {
						Stage: "Dormant",
						Company: "Becker Bikes",
						Email: "tom@example.com",
						"Last contact": "2026-03-20",
					},
				},
			],
		},
	],
} satisfies TemplateDef;
