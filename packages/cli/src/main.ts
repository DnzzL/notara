#!/usr/bin/env bun
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect } from "effect";
import { Command } from "effect/cli";
import type { NotaraError } from "./client.js";
import { root } from "./commands.js";

const cli = Command.runWith(root, { version: "0.1.0" });

cli(process.argv.slice(2)).pipe(
	Effect.catchTag("NotaraError", (e: NotaraError) =>
		Console.error(`✖ ${e.message}`).pipe(
			Effect.andThen(
				Effect.sync(() => {
					process.exitCode = 1;
				}),
			),
		),
	),
	Effect.provide([NodeHttpClient.layerNodeHttp, NodeServices.layer]),
	NodeRuntime.runMain,
);
