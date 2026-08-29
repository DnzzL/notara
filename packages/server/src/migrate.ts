import { Effect } from "effect";
import { runMigrations } from "./db.js";

await Effect.runPromise(
	runMigrations.pipe(
		Effect.tap(() => Effect.log("Migrations complete")),
		Effect.catchCause(Effect.logFatal),
	),
);
