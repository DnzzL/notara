/**
 * Two-(or-more)-user E2E harness.
 *
 * Setup runs over the RPC/auth HTTP surface (deterministic, no UI clicking);
 * assertions run in real browser contexts so presence, locks, and live sync are
 * exercised through the same code paths a user hits.
 *
 * Each user gets its own BrowserContext — cookies are per-context, so two users
 * hold live sessions against the same server at the same time.
 *
 * Sessions are worker-scoped, not per-test: the server rate-limits auth
 * mutations to 10/minute/IP (index.ts authHandlerStrict), which a per-test
 * signup blows through immediately. Isolation is preserved at the workspace
 * level instead — every test gets a fresh workspace, and presence state is keyed
 * by (workspaceId, pageId).
 */
import {
	type APIRequestContext,
	type Browser,
	type BrowserContext,
	test as base,
	expect,
	type Page,
	request,
} from "@playwright/test";

export const APP_ORIGIN = "http://localhost:5173";

/** Long-lived per-worker identity: credentials, HTTP session, browser context. */
export type UserSession = {
	label: string;
	email: string;
	password: string;
	name: string;
	userId: string;
	api: APIRequestContext;
	context: BrowserContext;
	dispose: () => Promise<void>;
};

/** A session plus the page under test, handed to specs. */
export type TestUser = Omit<UserSession, "dispose"> & {
	page: Page;
	rpc: <T = unknown>(
		method: string,
		payload?: Record<string, unknown>,
		workspaceId?: string,
	) => Promise<T>;
};

let rpcSeq = 1;

/**
 * Speaks the same wire protocol as packages/app/src/rpc-client.ts: a single
 * `Request` envelope in, an array of `Exit`/`Defect` results out.
 */
async function rpcCall<T>(
	api: APIRequestContext,
	method: string,
	payload: Record<string, unknown> | null = null,
	workspaceId?: string,
): Promise<T> {
	const id = String(rpcSeq++);
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

	const res = await api.post("/api", {
		headers,
		// Effect 4's RPC envelope requires `headers` even when empty, and a
		// void-payload call must send `null`, not `{}` — see rpc-client.ts.
		data: { _tag: "Request", id, tag: method, payload, headers: [] },
	});
	if (!res.ok())
		throw new Error(`RPC ${method} HTTP ${res.status()}: ${await res.text()}`);

	const results = (await res.json()) as Array<{
		_tag: string;
		requestId?: string;
		exit?: { _tag: string; value?: T; cause?: unknown };
		defect?: unknown;
	}>;

	const exit = results.find((r) => r.requestId === id && r._tag === "Exit");
	if (exit?.exit) {
		if (exit.exit._tag === "Failure") {
			throw new Error(
				`RPC ${method} failed: ${JSON.stringify(exit.exit.cause)}`,
			);
		}
		return exit.exit.value as T;
	}

	const defect = results.find((r) => r._tag === "Defect");
	if (defect)
		throw new Error(`RPC ${method} defect: ${JSON.stringify(defect.defect)}`);

	throw new Error(`RPC ${method}: no response for id ${id}`);
}

/** RPC issued on a caller-supplied HTTP context — used for anonymous-caller checks. */
export const rpcOnContext = rpcCall;

/**
 * Signs up a brand-new user and returns an authenticated API context plus a
 * browser context sharing the same session cookie.
 *
 * Consent is pre-seeded to "rejected" so the GDPR banner never overlaps the UI
 * under test (Reject == Accept for functionality; it only gates analytics).
 *
 * Retries once past the auth rate-limit window: back-to-back local runs share
 * the 10/min/IP budget, and a 429 here would fail every test in the worker.
 */
export async function createSession(
	browser: Browser,
	label: string,
): Promise<UserSession> {
	const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const email = `e2e-${label}-${unique}@example.com`;
	const password = "TestPassword123!";
	const name = `E2E ${label}`;

	const api = await request.newContext({ baseURL: APP_ORIGIN });
	let signUp = await api.post("/api/auth/sign-up/email", {
		data: { email, password, name },
	});
	if (signUp.status() === 429) {
		await new Promise((r) => setTimeout(r, 61_000));
		signUp = await api.post("/api/auth/sign-up/email", {
			data: { email, password, name },
		});
	}
	if (!signUp.ok()) {
		throw new Error(
			`sign-up for ${label} failed: ${signUp.status()} ${await signUp.text()}`,
		);
	}
	const body = (await signUp.json()) as { user?: { id?: string } };
	const userId = body.user?.id;
	if (!userId)
		throw new Error(
			`sign-up for ${label} returned no user id: ${JSON.stringify(body)}`,
		);

	const { cookies } = await api.storageState();
	const context = await browser.newContext({
		storageState: {
			cookies,
			origins: [
				{
					origin: APP_ORIGIN,
					localStorage: [{ name: "notara_consent", value: "rejected" }],
				},
			],
		},
	});

	return {
		label,
		email,
		password,
		name,
		userId,
		api,
		context,
		dispose: async () => {
			await context.close();
			await api.dispose();
		},
	};
}

export type SharedWorkspace = {
	workspaceId: string;
	slug: string;
	inviteToken: string;
};

/** Owner creates a workspace; the invite token comes back on the owner's row. */
export async function createWorkspaceAsOwner(
	owner: TestUser,
): Promise<SharedWorkspace> {
	const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	const slug = `e2e-ws-${unique}`;
	const ws = await owner.rpc<{
		id: string;
		slug: string;
		inviteToken: string | null;
	}>("createWorkspace", { name: `E2E Workspace ${unique}`, slug });
	if (!ws.inviteToken)
		throw new Error("createWorkspace returned no invite token for the owner");
	return { workspaceId: ws.id, slug: ws.slug, inviteToken: ws.inviteToken };
}

/** Second user accepts the invite over RPC (same call the /join/$token route makes). */
export async function joinWorkspace(
	user: TestUser,
	inviteToken: string,
): Promise<void> {
	await user.rpc("joinWorkspaceByToken", { inviteToken });
}

export type SeededPage = {
	pageId: string;
	/** Block ids in creation order. */
	blockIds: string[];
};

/** Creates a page with one paragraph block per supplied text. */
export async function seedPage(
	owner: TestUser,
	ws: SharedWorkspace,
	title: string,
	paragraphs: string[],
): Promise<SeededPage> {
	const page = await owner.rpc<{ id: string }>(
		"createPage",
		{ title, parentId: null },
		ws.workspaceId,
	);
	const blockIds: string[] = [];
	for (const [index, text] of paragraphs.entries()) {
		const block = await owner.rpc<{ id: string }>(
			"createBlock",
			{
				pageId: page.id,
				type: "paragraph",
				content: `<p>${text}</p>`,
				index,
				parentId: null,
			},
			ws.workspaceId,
		);
		blockIds.push(block.id);
	}
	return { pageId: page.id, blockIds };
}

/**
 * Opens a specific page in a user's browser and waits until its blocks are
 * mounted — `?page=` is honoured by the workspace route's loader.
 */
export async function openPage(
	user: TestUser,
	ws: SharedWorkspace,
	pageId: string,
): Promise<void> {
	await user.page.goto(`/${ws.slug}?page=${pageId}`);
	await user.page
		.locator(".block-node")
		.first()
		.waitFor({ state: "visible", timeout: 20_000 });
}

/**
 * Seed a page, open it in both users' browsers, and wait until each sees the
 * other. The starting point for every spec that asserts on collaboration.
 */
export async function meetOnPage(
	owner: TestUser,
	peer: TestUser,
	ws: SharedWorkspace,
	title: string,
	paragraphs: string[],
): Promise<SeededPage> {
	const seeded = await seedPage(owner, ws, title, paragraphs);
	await openPage(owner, ws, seeded.pageId);
	await openPage(peer, ws, seeded.pageId);
	await expect(presenceAvatars(owner)).toHaveCount(1, { timeout: 15_000 });
	return seeded;
}

/**
 * Switch pages the way a user does: clicking the sidebar entry, which is
 * client-side routing. Distinct from openPage(), which reloads the document —
 * that tears the app down and is only representative of closing a tab.
 */
export async function navigateToPageInApp(
	user: TestUser,
	title: string,
): Promise<void> {
	await user.page
		.locator("[data-sidebar]")
		.getByText(title, { exact: true })
		.first()
		.click();
	await user.page
		.locator("h1", { hasText: title })
		.waitFor({ state: "visible", timeout: 20_000 });
}

/**
 * Register presence on a page over HTTP, with no browser involved. Lets a spec
 * model a client that appears and then goes silent — no unload handler, no
 * leave request — which is the only honest way to exercise the TTL sweep.
 */
export async function heartbeatOnce(
	user: TestUser,
	ws: SharedWorkspace,
	pageId: string,
): Promise<void> {
	const res = await user.api.post("/api/presence/heartbeat", {
		headers: { "Content-Type": "application/json" },
		data: { workspaceId: ws.workspaceId, pageId, focusedBlockId: null },
	});
	if (!res.ok())
		throw new Error(`heartbeat failed: ${res.status()} ${await res.text()}`);
}

/** Blocks rendered on the open page, in DOM order. */
export function blockNodes(user: TestUser) {
	return user.page.locator(".block-node");
}

/** The editable surface of the nth block on the open page. */
export function blockEditor(user: TestUser, index: number) {
	return user.page.locator(".block-node").nth(index).locator(".ProseMirror");
}

/** Avatars of *other* users present on the open page. */
export function presenceAvatars(user: TestUser) {
	return user.page.locator(".presence-avatars .presence-avatar");
}

/** The peer-lock badge on the nth block (hidden via CSS when unlocked). */
export function lockBadge(user: TestUser, index: number) {
	return user.page
		.locator(".block-node")
		.nth(index)
		.locator(".block-lock-badge");
}

/** Rendered toast titles, used to assert the BlockLocked feedback. */
export function toastTitles(user: TestUser) {
	return user.page.locator(".toast-title");
}

/** Server-side truth for a page's blocks — used to assert what actually persisted. */
export async function fetchBlocks(
	user: TestUser,
	ws: SharedWorkspace,
	pageId: string,
): Promise<Array<{ id: string; content: string; index: number }>> {
	return user.rpc("listBlocks", { pageId }, ws.workspaceId);
}

type WorkerFixtures = {
	aliceSession: UserSession;
	bobSession: UserSession;
};

type TestFixtures = {
	/** Workspace owner, with a fresh tab for this test. */
	alice: TestUser;
	/** Second user, with a fresh tab for this test. Not a member until invited. */
	bob: TestUser;
	/** A workspace owned by alice that bob has already joined. */
	sharedWs: SharedWorkspace;
	/** A workspace owned by alice that nobody else has joined. */
	soloWs: SharedWorkspace;
};

async function withFreshPage(
	session: UserSession,
	use: (u: TestUser) => Promise<void>,
) {
	const page = await session.context.newPage();
	const user: TestUser = {
		...session,
		page,
		rpc: (method, payload, workspaceId) =>
			rpcCall(session.api, method, payload, workspaceId),
	};
	await use(user);
	// The spec may have swapped in its own page (offline/reconnect scenarios).
	for (const p of session.context.pages()) await p.close();
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	aliceSession: [
		async ({ browser }, use) => {
			const session = await createSession(browser, "alice");
			await use(session);
			await session.dispose();
		},
		// Generous: createSession waits out the auth rate-limit window on a 429.
		{ scope: "worker", timeout: 120_000 },
	],
	bobSession: [
		async ({ browser }, use) => {
			const session = await createSession(browser, "bob");
			await use(session);
			await session.dispose();
		},
		// Generous: createSession waits out the auth rate-limit window on a 429.
		{ scope: "worker", timeout: 120_000 },
	],
	alice: async ({ aliceSession }, use) => {
		await withFreshPage(aliceSession, use);
	},
	bob: async ({ bobSession }, use) => {
		await withFreshPage(bobSession, use);
	},
	soloWs: async ({ alice }, use) => {
		await use(await createWorkspaceAsOwner(alice));
	},
	sharedWs: async ({ alice, bob }, use) => {
		const ws = await createWorkspaceAsOwner(alice);
		await joinWorkspace(bob, ws.inviteToken);
		await use(ws);
	},
});

export { expect } from "@playwright/test";
