/**
 * Every operation in the typed table has a CLI command, and every command that
 * names an operation names a real one.
 *
 * Each CLI command declares the `operationId` it calls (`OperationId`
 * annotation); this walks the command tree the CLI actually runs and compares.
 */
import { describe, expect, test } from "bun:test";
import { Context } from "effect";
import type { Command } from "effect/cli";
import { OperationId, root } from "../../cli/src/commands.js";
import { typedOperations } from "../src/api-v1/operations.js";

const declaredOperationIds = (cmd: Command.Command.Any): string[] => [
	...Context.getOption(cmd.annotations, OperationId).pipe((o) =>
		o._tag === "Some" ? [o.value] : [],
	),
	...cmd.subcommands.flatMap((g) => g.commands.flatMap(declaredOperationIds)),
];

describe("CLI parity with the operation table", () => {
	test("each operationId has exactly one CLI command", () => {
		expect(declaredOperationIds(root).sort()).toEqual(
			typedOperations.map((op) => op.operationId).sort(),
		);
	});
});
