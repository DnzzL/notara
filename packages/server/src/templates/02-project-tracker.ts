import { h1, h2, OL, p, type TemplateDef, UL } from "./_kit.js";

export default {
	id: "project-tracker",
	title: "Project Tracker",
	icon: "🗂️",
	description: "Tasks board + table, with a linked project brief sub-page.",
	blocks: [
		h1("Project Tracker 🗂️"),
		p(
			"Track tasks, assign owners, and manage your sprint. Switch to the <strong>Board</strong> view for a Kanban layout.",
		),
		h2("📂 Project docs"),
		p(
			"Supporting docs live as sub-pages so the tracker stays focused on tasks:",
		),
		{ kind: "childLinks" },
		{ kind: "block", type: "divider", content: "" },
		h2("Sprints"),
		p(
			"Group work into sprints. Tasks link here via a <strong>relation</strong>.",
		),
		{
			kind: "database",
			name: "Sprints",
			titleLabel: "Sprint",
			fields: [
				{
					name: "Status",
					type: "select",
					options: ["Planned", "Active", "Done"],
				},
				{ name: "Dates", type: "text" },
			],
			views: [{ name: "Table", type: "table" }],
			records: [
				{
					title: "Sprint 1 — Foundation",
					values: { Status: "Done", Dates: "Weeks 1–2" },
				},
				{
					title: "Sprint 2 — Core features",
					values: { Status: "Active", Dates: "Weeks 3–4" },
				},
				{
					title: "Sprint 3 — Launch",
					values: { Status: "Planned", Dates: "Weeks 5–6" },
				},
			],
		},
		h2("Tasks"),
		p(
			"Each task links to its <strong>Sprint</strong> (a relation to the database above) and can point to a <strong>Spec</strong> page.",
		),
		{
			kind: "database",
			name: "Tasks",
			titleLabel: "Task",
			fields: [
				{
					name: "Status",
					type: "select",
					options: ["Todo", "In Progress", "Done", "Blocked"],
				},
				{
					name: "Priority",
					type: "select",
					options: ["Low", "Medium", "High"],
				},
				{
					name: "Assignee",
					type: "select",
					options: ["Alex", "Sam", "Jordan"],
				},
				{ name: "Sprint", type: "relation", relationTargetName: "Sprints" },
				{ name: "Spec", type: "page" },
				{ name: "Due date", type: "date" },
			],
			views: [
				{ name: "Table", type: "table" },
				{ name: "Board", type: "board", groupByFieldName: "Status" },
			],
			records: [
				{
					title: "Define project scope",
					values: { Status: "Done", Priority: "High", Assignee: "Alex" },
					relations: { Sprint: ["Sprint 1 — Foundation"] },
					pageLinks: { Spec: "Project Brief" },
				},
				{
					title: "Set up repository & CI",
					values: { Status: "Done", Priority: "High", Assignee: "Sam" },
					relations: { Sprint: ["Sprint 1 — Foundation"] },
				},
				{
					title: "Design system architecture",
					values: {
						Status: "In Progress",
						Priority: "High",
						Assignee: "Alex",
					},
					relations: { Sprint: ["Sprint 2 — Core features"] },
					pageLinks: { Spec: "Project Brief" },
				},
				{
					title: "Implement core features",
					values: {
						Status: "In Progress",
						Priority: "Medium",
						Assignee: "Jordan",
					},
					relations: { Sprint: ["Sprint 2 — Core features"] },
				},
				{
					title: "Write documentation",
					values: { Status: "Todo", Priority: "Medium", Assignee: "Sam" },
					relations: { Sprint: ["Sprint 3 — Launch"] },
				},
				{
					title: "Deploy to staging",
					values: { Status: "Todo", Priority: "Medium" },
					relations: { Sprint: ["Sprint 3 — Launch"] },
				},
				{
					title: "Ship v1.0",
					values: { Status: "Todo", Priority: "High" },
					relations: { Sprint: ["Sprint 3 — Launch"] },
				},
			],
		},
	],
	children: [
		{
			title: "Project Brief",
			icon: "📋",
			blocks: [
				h1("Project Brief 📋"),
				h2("Goal"),
				p(
					"What are we building and why? Capture the problem and the outcome that defines success.",
				),
				h2("Scope"),
				{
					kind: "block",
					type: "bulletList",
					content: UL(["In scope: …", "Out of scope: …"]),
				},
				h2("Milestones"),
				{
					kind: "block",
					type: "numberedList",
					content: OL([
						"Kickoff & scope locked",
						"MVP feature-complete",
						"Beta with first users",
						"v1.0 launch",
					]),
				},
				h2("Stakeholders"),
				{
					kind: "block",
					type: "bulletList",
					content: UL(["Product: …", "Engineering: …", "Design: …"]),
				},
			],
		},
	],
} satisfies TemplateDef;
