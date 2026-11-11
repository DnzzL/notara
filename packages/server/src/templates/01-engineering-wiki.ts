import {
	CALLOUT,
	h1,
	h2,
	OL,
	p,
	type TemplateDef,
	TODO,
	TOGGLE,
	UL,
} from "./_kit.js";

export default {
	id: "engineering-wiki",
	title: "Engineering Wiki",
	icon: "📚",
	description: "Docs, runbooks, architecture — a real nested knowledge base.",
	blocks: [
		h1("Engineering Wiki 📚"),
		p(
			"Your team's home base for docs, decisions, and how-tos. Expand a section to read it, collapse it to scan. Deeper guides live as their own sub-pages.",
		),
		{
			kind: "block",
			type: "toggle",
			content: TOGGLE(
				"🚀 Getting Started",
				"<p>Get a local environment running:</p>" +
					UL([
						"Clone: <code>git clone &lt;repo-url&gt;</code>",
						"Install: <code>npm install</code>",
						"Start: <code>npm run dev</code>",
					]),
			),
		},
		{
			kind: "block",
			type: "toggle",
			content: TOGGLE(
				"🏗️ Architecture",
				"<p>How the pieces fit together:</p>" +
					UL([
						"<strong>Frontend</strong> (React) — the editor and UI",
						"<strong>API server</strong> (Node/Effect) — business logic and auth",
						"<strong>SQLite</strong> — single-file storage you control",
					]),
			),
		},
		{
			kind: "block",
			type: "toggle",
			content: TOGGLE(
				"📐 Standards & Conventions",
				UL([
					"Code style: ESLint + Prettier (<code>npm run lint</code> before committing)",
					"Git: feature branches → PR → squash merge into <code>main</code>",
					"Tests: unit for business logic, integration for APIs",
				]),
			),
		},
		h2("📂 Sub-pages"),
		p(
			"Deeper docs live as their own pages. Click in below, or browse the nested tree in the sidebar — sub-pages can nest as deep as you like.",
		),
		{ kind: "childLinks" },
	],
	children: [
		{
			title: "Runbooks",
			icon: "📕",
			blocks: [
				h1("Runbooks 📕"),
				p(
					"Step-by-step operational procedures. Open one below, or add your own as a new sub-page of this one.",
				),
				h2("Procedures"),
				{ kind: "childLinks" },
			],
			children: [
				{
					title: "Deploy to Production",
					icon: "🚀",
					blocks: [
						h1("Deploy to Production 🚀"),
						{
							kind: "block",
							type: "callout",
							content: CALLOUT(
								"⚠️ Before you start",
								"CI is green on <code>main</code> and the deploy window is announced in the team channel.",
							),
						},
						h2("Steps"),
						{
							kind: "block",
							type: "numberedList",
							content: OL([
								"Merge to <code>main</code> and wait for CI to pass",
								"Tag the release: <code>git tag vX.Y.Z</code>",
								"Run <code>npm run deploy:prod</code>",
								"Verify health checks and smoke-test the live site",
								"Announce the deploy in the team channel",
							]),
						},
						{
							kind: "block",
							type: "callout",
							content: CALLOUT(
								"↩️ Rollback",
								"Re-deploy the previous tag: <code>npm run deploy:prod -- --tag vX.Y.(Z-1)</code>",
							),
						},
					],
				},
				{
					title: "Incident Response",
					icon: "🚨",
					blocks: [
						h1("Incident Response 🚨"),
						{
							kind: "block",
							type: "callout",
							content: CALLOUT(
								"🔴 Severity",
								"SEV1 = full outage · SEV2 = major degradation · SEV3 = minor / workaround exists.",
							),
						},
						h2("Playbook"),
						{
							kind: "block",
							type: "numberedList",
							content: OL([
								"Acknowledge — claim the incident so there's a single owner",
								"Assess — scope the impact and assign a severity",
								"Mitigate — stop the bleeding (roll back, disable, scale)",
								"Communicate — post status updates on a fixed cadence",
								"Resolve & write a blameless postmortem",
							]),
						},
					],
				},
			],
		},
		{
			title: "Onboarding Guide",
			icon: "🧭",
			blocks: [
				h1("Onboarding Guide 🧭"),
				p("Welcome aboard! Work through this during your first week."),
				h2("First-week checklist"),
				{
					kind: "block",
					type: "todo",
					content: TODO("Get access to the repo, CI, and the team channel"),
				},
				{
					kind: "block",
					type: "todo",
					content: TODO("Set up your local environment (see Getting Started)"),
				},
				{
					kind: "block",
					type: "todo",
					content: TODO("Read the Architecture section and the Runbooks"),
				},
				{
					kind: "block",
					type: "todo",
					content: TODO("Ship a small PR to learn the workflow"),
				},
				{
					kind: "block",
					type: "todo",
					content: TODO("Pair with a teammate on a real task"),
				},
				{
					kind: "block",
					type: "toggle",
					content: TOGGLE(
						"🔗 Handy links",
						UL([
							"Repo & PR guidelines",
							"Design system / component library",
							"On-call schedule",
						]),
					),
				},
			],
		},
	],
} satisfies TemplateDef;
