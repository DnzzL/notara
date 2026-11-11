/**
 * `/llms.txt` (llmstxt.org): what an agent reads first on an instance.
 * Generated from the operation table, so an operation added there shows up
 * here with no edit to this file. The agents page parses the two scope
 * sections, so keep their `## Read operations` / `## Write operations` headings.
 */
import type { AnyOperation } from "./operations.js";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export const llmsTxt = (
	operations: ReadonlyArray<AnyOperation>,
	baseUrl: string,
): string => {
	const list = (scope: "read" | "write") =>
		operations
			.filter((op) => op.scope === scope)
			.map((op) => `- ${op.operationId}: ${oneLine(op.summary)}`)
			.join("\n");
	return `# Notara

> Notes, docs and databases you self-host, drivable by agents over REST and MCP.

## Connect

- [OpenAPI document](${baseUrl}/api/v1/openapi.json): every REST route, with its schemas
- [MCP endpoint](${baseUrl}/mcp): Streamable HTTP, one tool per operation, \`Authorization: Bearer ntr_…\`
- [Change events](${baseUrl}/api/v1/workspaces/{workspaceId}/events): server-sent events for every page, block and record change, same \`Authorization: Bearer ntr_…\`; react instead of polling
- [Agents guide](${baseUrl}/agents): MCP setup for Claude Code and Cursor, API key scopes

## Read operations

Allowed to any API key.

${list("read")}

## Write operations

Need a write key; a read key neither sees nor can call them.

${list("write")}
`;
};
