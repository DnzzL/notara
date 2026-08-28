/**
 * Pointing a public page's assets at the route that will actually serve them.
 *
 * A block stores its image as `/attachments/<ulid>.png`, written long before
 * sharing existed. That route requires a session (ADR-006), so a stranger
 * reading a shared page would get a 401 for every picture on it. The server
 * serves the same files at `/api/public/pages/<token>/attachments/<file>`,
 * scoped to the one page the token published — so the rewrite is the client's
 * half of that arrangement.
 *
 * Rewriting rather than storing the public URL is deliberate: the stored
 * content must stay identical whether or not a page is shared, or revoking a
 * share would mean rewriting every block back.
 */

/**
 * Either an already-public URL or a bare one, in that order.
 *
 * The alternation is what makes the rewrite idempotent: an already-rewritten
 * URL matches the first branch, which captures nothing and is put back
 * untouched. Without it the second branch would find the `/attachments/` inside
 * a public URL and nest the prefix, 404ing everything on a re-render.
 */
const ATTACHMENT_URL =
	/\/api\/public\/pages\/[^/"'\s]+\/attachments\/[a-zA-Z0-9._-]+|(?:\.\.\/)*\/?attachments\/([a-zA-Z0-9._-]+)/g;

/** The public URL for one attachment of a shared page. */
export const publicAttachmentUrl = (token: string, fileName: string): string =>
	`/api/public/pages/${encodeURIComponent(token)}/attachments/${fileName}`;

/**
 * Repoint every attachment URL in a string at the public route.
 *
 * Runs over whole HTML rather than a parsed src, because a text block can
 * carry an inline `<img>` just as an image block carries a JSON `src`. One
 * pass over the string covers both without either caller having to know which
 * shape it is holding.
 */
export const rewriteAttachmentUrls = (content: string, token: string): string =>
	content.replace(ATTACHMENT_URL, (match, fileName: string | undefined) =>
		fileName === undefined ? match : publicAttachmentUrl(token, fileName),
	);
