import { Effect } from "effect";
import { runMigrations } from "./db.js";

runMigrations.pipe(
	Effect.tap(() => Effect.log("Migrations complete")),
	Effect.catchAllCause(Effect.logFatal),
);
