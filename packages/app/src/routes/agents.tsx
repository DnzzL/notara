import { createRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Route as rootRoute } from "./__root.js";

/** The `- name: summary` lines under a `## <title>` heading of /llms.txt. */
const section = (txt: string, title: string) =>
	(txt.split(`## ${title}`)[1] ?? "")
		.split("\n## ")[0]
		.split("\n")
		.filter((l) => l.startsWith("- "))
		.map((l) => l.slice(2));

function AgentsPage() {
	const origin = window.location.origin;
	const [ops, setOps] = useState<{ read: string[]; write: string[] }>();

	// The operation lists come from the server's /llms.txt, itself generated
	// from the operation table: nothing to keep in sync here.
	useEffect(() => {
		fetch("/llms.txt")
			.then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
			.then((txt) => {
				const read = section(txt, "Read operations");
				// Anything that is not the generated file (an SPA fallback) has no list.
				if (read.length === 0) throw new Error("no operations in /llms.txt");
				setOps({ read, write: section(txt, "Write operations") });
			})
			.catch(() => setOps(undefined));
	}, []);

	const cursor = JSON.stringify(
		{
			mcpServers: {
				notara: {
					url: `${origin}/mcp`,
					headers: { Authorization: "Bearer ntr_your_key_here" },
				},
			},
		},
		null,
		2,
	);

	return (
		<div className="legal-page">
			<nav className="legal-nav">
				<Link to="/" className="legal-back">
					← Notara
				</Link>
			</nav>
			<article className="legal-content">
				<h1>Agents</h1>
				<p>
					Notara exposes the same operations over REST (
					<a href="/api/docs">OpenAPI</a>), the <code>notara</code> CLI and an
					MCP server at <code>{origin}/mcp</code>. Agents can discover them from{" "}
					<a href="/llms.txt">/llms.txt</a>.
				</p>

				<h2>1. Create an API key</h2>
				<p>
					In Notara, open the sidebar → API keys and create a key (
					<code>ntr_…</code>). Pick its scope first, see below.
				</p>

				<h2>2. Connect Claude Code</h2>
				<pre>
					<code>{`claude mcp add --transport http notara ${origin}/mcp \\
  --header "Authorization: Bearer ntr_your_key_here"`}</code>
				</pre>

				<h2>3. Connect Cursor</h2>
				<p>
					Put this in <code>.cursor/mcp.json</code> (or{" "}
					<code>~/.cursor/mcp.json</code> for every project):
				</p>
				<pre>
					<code>{cursor}</code>
				</pre>

				<h2>4. React to changes</h2>
				<p>
					Instead of polling, listen to{" "}
					<code>GET {origin}/api/v1/workspaces/&lt;workspaceId&gt;/events</code>{" "}
					with the same key. It streams server-sent events: each{" "}
					<code>change</code> names the <code>kind</code> (page, block or
					record), the <code>op</code> (create, update or delete), the{" "}
					<code>id</code> and who made it. You only hear about what the key may
					read, and a read key may listen.
				</p>
				<pre>
					<code>{`curl -N ${origin}/api/v1/workspaces/<workspaceId>/events \
  -H "Authorization: Bearer ntr_your_key_here"`}</code>
				</pre>

				<h2>API key scopes</h2>
				<p>
					<strong>read</strong> keys only read: write tools are not listed over
					MCP and REST refuses them with a 403. <strong>write</strong> keys can
					run every operation, within what their owner may do. Either way,
					workspace membership and page permissions still apply.
				</p>
				{ops ? (
					<>
						<h3>Read keys allow ({ops.read.length})</h3>
						<ul>
							{ops.read.map((o) => (
								<li key={o}>{o}</li>
							))}
						</ul>
						<h3>Write keys also allow ({ops.write.length})</h3>
						<ul>
							{ops.write.map((o) => (
								<li key={o}>{o}</li>
							))}
						</ul>
					</>
				) : (
					<p>
						The live list of operations is in <a href="/llms.txt">/llms.txt</a>.
					</p>
				)}
			</article>
		</div>
	);
}

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/agents",
	component: AgentsPage,
});
