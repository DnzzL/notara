import { SqlClient, type SqlError } from "@effect/sql";
import { NotFoundError } from "@notara/shared";
import { Effect } from "effect";
import { ulid } from "ulidx";
import { PAGE_COLS, pageFromRow } from "../mappers.js";

type PlainBlock = { kind: "block"; type: string; content: string };
type DatabaseBlock = {
	kind: "database";
	name: string;
	titleLabel: string;
	fields: FieldDef[];
	views: ViewDef[];
	records: RecordDef[];
};
/** Emits one `pageLink` block per child page, in order — an inline index of sub-pages. */
type ChildLinksBlock = { kind: "childLinks" };
type BlockDef = PlainBlock | DatabaseBlock | ChildLinksBlock;
type FieldDef = {
	name: string;
	type: string;
	options?: string[];
	/** For `relation` fields: the `name` of the target database block (use this
	 *  database's own name for a self-relation). Resolved to its id at build time. */
	relationTargetName?: string;
};
type ViewDef = {
	name: string;
	type: "table" | "board";
	groupByFieldName?: string;
};
type RecordDef = {
	title: string;
	values?: Record<string, string>;
	/** `relation` field values, by field name → target record titles. */
	relations?: Record<string, string[]>;
	/** `page` field values, by field name → linked page title (e.g. a sub-page). */
	pageLinks?: Record<string, string>;
};

interface PageDef {
	title: string;
	icon: string;
	blocks: BlockDef[];
	children?: PageDef[];
}

interface TemplateDef extends PageDef {
	id: string;
	description: string;
}

const CALLOUT = (summary: string, body?: string) =>
	`<details open=""><summary>${summary}</summary><div data-details-content=""><p>${body ?? ""}</p></div></details>`;

/** Collapsible section. `bodyHtml` may contain block-level HTML (p, ul, pre…). */
const TOGGLE = (summary: string, bodyHtml: string) =>
	`<details open=""><summary>${summary}</summary><div data-details-content="">${bodyHtml}</div></details>`;

const TODO = (text: string, checked = false) =>
	`<ul class="task-list"><li data-checked="${checked}">${text}</li></ul>`;

const BULLET = (text: string) => `<ul><li>${text}</li></ul>`;
const UL = (items: string[]) =>
	`<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const OL = (items: string[]) =>
	`<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;

// Shorthand block constructors.
const h1 = (t: string): PlainBlock => ({
	kind: "block",
	type: "heading1",
	content: `<h1>${t}</h1>`,
});
const h2 = (t: string): PlainBlock => ({
	kind: "block",
	type: "heading2",
	content: `<h2>${t}</h2>`,
});
const p = (t: string): PlainBlock => ({
	kind: "block",
	type: "paragraph",
	content: `<p>${t}</p>`,
});

export const TEMPLATES: TemplateDef[] = [
	// ── 1. Engineering Wiki ───────────────────────────────────────────────────
	{
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
						content: TODO(
							"Set up your local environment (see Getting Started)",
						),
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
	},

	// ── 2. Project / Sprint Tracker ───────────────────────────────────────────
	{
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
	},

	// ── 3. Meeting Notes ─────────────────────────────────────────────────────
	{
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
	},

	// ── 4. Bug / Issue Tracker ────────────────────────────────────────────────
	{
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
	},
];

export const getTemplates = () =>
	TEMPLATES.map(({ id, title, icon, description }) => ({
		id,
		title,
		icon,
		description,
	}));

/** Shared, mutable resolution context for a single template build. Lets later
 *  pages/databases reference earlier ones by title/name (relations, page links). */
interface BuildCtx {
	/** Page title → page id, for resolving `page` field links to sub-pages. */
	pageIdByTitle: Map<string, string>;
	/** Database name → { id, record title → record id }, for resolving relations. */
	dbByName: Map<string, { id: string; recordIdByTitle: Map<string, string> }>;
}

/** Recursively create a page, its sub-pages, and its blocks. Sub-pages are
 *  created first so a `childLinks` block can reference them. Returns the page id. */
const buildPage = (
	def: PageDef,
	parentId: string | null,
	sortOrder: number,
	now: string,
	ctx: BuildCtx,
): Effect.Effect<string, SqlError.SqlError, SqlClient.SqlClient> =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const pageId = ulid();

		yield* sql`
      INSERT INTO pages (id, title, parent_id, icon, sort_order, created_at, updated_at)
      VALUES (${pageId}, ${def.title}, ${parentId}, ${def.icon}, ${sortOrder}, ${now}, ${now})
    `;
		ctx.pageIdByTitle.set(def.title, pageId);

		// Children first, so childLinks blocks can point at them.
		const childIds: string[] = [];
		if (def.children) {
			for (let ci = 0; ci < def.children.length; ci++) {
				const cid = yield* buildPage(
					def.children[ci],
					pageId,
					ci + 1,
					now,
					ctx,
				);
				childIds.push(cid);
			}
		}

		let blockIndex = 0;
		let dbOrder = 0;
		for (const blockDef of def.blocks) {
			if (blockDef.kind === "block") {
				yield* sql`
          INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
          VALUES (${ulid()}, ${pageId}, ${blockDef.type}, ${blockDef.content}, ${blockIndex}, NULL)
        `;
				blockIndex++;
				continue;
			}

			if (blockDef.kind === "childLinks") {
				for (const cid of childIds) {
					yield* sql`
            INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
            VALUES (${ulid()}, ${pageId}, 'pageLink', ${cid}, ${blockIndex}, NULL)
          `;
					blockIndex++;
				}
				continue;
			}

			// Database block. No `database`-type block is inserted: the editor
			// renders databases attached to a page (and not pointed at by an inline
			// block) as "orphans" after the block list, which matches the /database
			// slash command and renders correctly. sort_order controls the order in
			// which multiple databases on one page appear.
			const dbId = ulid();
			yield* sql`
        INSERT INTO databases (id, page_id, name, title_label, title_hidden, sort_order)
        VALUES (${dbId}, ${pageId}, ${blockDef.name}, ${blockDef.titleLabel}, 0, ${dbOrder++})
      `;
			const recordIdByTitle = new Map<string, string>();
			ctx.dbByName.set(blockDef.name, { id: dbId, recordIdByTitle });

			const fieldIdMap: Record<string, string> = {};
			for (let fi = 0; fi < blockDef.fields.length; fi++) {
				const field = blockDef.fields[fi];
				const fieldId = ulid();
				fieldIdMap[field.name] = fieldId;
				const options = field.options ? JSON.stringify(field.options) : null;
				// A relation's target may be this same database (self-relation) or one
				// created earlier on the page; both are already registered in dbByName.
				const relationTargetDbId = field.relationTargetName
					? field.relationTargetName === blockDef.name
						? dbId
						: (ctx.dbByName.get(field.relationTargetName)?.id ?? null)
					: null;
				yield* sql`
          INSERT INTO database_fields (id, database_id, name, type, options, relation_target_db_id, formula, sort_order)
          VALUES (${fieldId}, ${dbId}, ${field.name}, ${field.type}, ${options}, ${relationTargetDbId}, NULL, ${fi + 1})
        `;
			}

			for (const view of blockDef.views) {
				const groupByFieldId = view.groupByFieldName
					? (fieldIdMap[view.groupByFieldName] ?? null)
					: null;
				yield* sql`
          INSERT INTO database_views (id, database_id, name, type, group_by_field_id, sort_order)
          VALUES (${ulid()}, ${dbId}, ${view.name}, ${view.type}, ${groupByFieldId}, 'asc')
        `;
			}

			// First pass: create records (+ literal values) and register their ids.
			const recordIds: string[] = [];
			for (let ri = 0; ri < blockDef.records.length; ri++) {
				const rec = blockDef.records[ri];
				const recordId = ulid();
				recordIds.push(recordId);
				recordIdByTitle.set(rec.title, recordId);
				yield* sql`
          INSERT INTO database_records (id, database_id, title, sort_order, created_at)
          VALUES (${recordId}, ${dbId}, ${rec.title}, ${ri + 1}, ${now})
        `;
				if (rec.values) {
					for (const [fieldName, rawValue] of Object.entries(rec.values)) {
						const fieldId = fieldIdMap[fieldName];
						if (!fieldId) continue;
						const field = blockDef.fields.find((f) => f.name === fieldName);
						const value =
							field?.type === "multiSelect"
								? JSON.stringify([rawValue])
								: rawValue;
						yield* sql`
              INSERT INTO record_field_values (id, record_id, field_id, value)
              VALUES (${ulid()}, ${recordId}, ${fieldId}, ${value})
            `;
					}
				}
			}

			// Second pass: relation + page-link values, now that every record id and
			// sub-page id is known (handles self-relations and cross-database links).
			for (let ri = 0; ri < blockDef.records.length; ri++) {
				const rec = blockDef.records[ri];
				const recordId = recordIds[ri];

				for (const [fieldName, targetTitles] of Object.entries(
					rec.relations ?? {},
				)) {
					const fieldId = fieldIdMap[fieldName];
					const targetName = blockDef.fields.find(
						(f) => f.name === fieldName,
					)?.relationTargetName;
					const targetMap = targetName
						? ctx.dbByName.get(targetName)?.recordIdByTitle
						: undefined;
					if (!fieldId || !targetMap) continue;
					const ids = targetTitles
						.map((t) => targetMap.get(t))
						.filter((x): x is string => !!x);
					if (ids.length === 0) continue;
					yield* sql`
            INSERT INTO record_field_values (id, record_id, field_id, value)
            VALUES (${ulid()}, ${recordId}, ${fieldId}, ${JSON.stringify(ids)})
          `;
				}

				for (const [fieldName, pageTitle] of Object.entries(
					rec.pageLinks ?? {},
				)) {
					const fieldId = fieldIdMap[fieldName];
					const linkedPageId = ctx.pageIdByTitle.get(pageTitle);
					if (!fieldId || !linkedPageId) continue;
					yield* sql`
            INSERT INTO record_field_values (id, record_id, field_id, value)
            VALUES (${ulid()}, ${recordId}, ${fieldId}, ${JSON.stringify([linkedPageId])})
          `;
				}
			}
		}

		return pageId;
	});

export const createPageFromTemplate = (req: {
	templateId: string;
	parentId: string | null;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const template = TEMPLATES.find((t) => t.id === req.templateId);
		if (!template)
			return yield* new NotFoundError({
				resource: "template",
				id: req.templateId,
			});

		const now = new Date().toISOString();
		const siblingMaxOrder = req.parentId
			? yield* sql`
          SELECT COALESCE(MAX(sort_order), 0) as max_order
          FROM pages WHERE parent_id = ${req.parentId} AND is_deleted = 0
        `
			: yield* sql`
          SELECT COALESCE(MAX(sort_order), 0) as max_order
          FROM pages WHERE parent_id IS NULL AND is_deleted = 0
        `;
		const sortOrder = (Number((siblingMaxOrder[0] as any)?.max_order) || 0) + 1;

		const ctx: BuildCtx = { pageIdByTitle: new Map(), dbByName: new Map() };
		const pageId = yield* buildPage(
			template,
			req.parentId,
			sortOrder,
			now,
			ctx,
		);

		const rows = yield* sql.unsafe(
			`SELECT ${PAGE_COLS} FROM pages WHERE id = ?`,
			[pageId],
		);
		return pageFromRow(rows[0]);
	});
