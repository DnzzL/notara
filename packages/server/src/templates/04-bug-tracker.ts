import { h1, p, type TemplateDef } from "./_kit.js";

export default {
	id: "bug-tracker",
	title: "Bug Tracker",
	icon: "🐛",
	description: "Report, triage, and track issues. Board view by status.",
	blocks: [
		h1("Bug Tracker 🐛"),
		p(
			"Report issues, set severity and status, and track them to resolution. Your data stays on your server.",
		),
		{ kind: "block", type: "divider", content: "" },
		{
			kind: "database",
			name: "Issues",
			titleLabel: "Issue",
			fields: [
				{
					name: "Severity",
					type: "select",
					options: ["Critical", "High", "Medium", "Low"],
				},
				{
					name: "Status",
					type: "select",
					options: ["Open", "In Progress", "Fixed", "Won't Fix"],
				},
				{ name: "Component", type: "text" },
				{
					name: "Reported by",
					type: "select",
					options: ["Alex", "Sam", "Jordan"],
				},
			],
			views: [
				{ name: "All issues", type: "table" },
				{ name: "By status", type: "board", groupByFieldName: "Status" },
			],
			records: [
				{
					title: "Login fails on Safari with OAuth",
					values: {
						Severity: "High",
						Status: "Open",
						Component: "Auth",
						"Reported by": "Alex",
					},
				},
				{
					title: "Export button missing on mobile",
					values: {
						Severity: "Medium",
						Status: "In Progress",
						Component: "UI",
						"Reported by": "Sam",
					},
				},
				{
					title: "Search returns stale results after edit",
					values: {
						Severity: "High",
						Status: "Open",
						Component: "Search",
						"Reported by": "Jordan",
					},
				},
				{
					title: "Typo in onboarding error message",
					values: {
						Severity: "Low",
						Status: "Fixed",
						Component: "Onboarding",
						"Reported by": "Sam",
					},
				},
			],
		},
	],
} satisfies TemplateDef;
