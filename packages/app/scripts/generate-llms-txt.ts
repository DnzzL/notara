/**
 * Writes `public/llms.txt` from the one source of truth in the server, `llmsTxt`
 * (NOT-182). The deployment sends `/api/*` to the server and every other path to
 * the static app container, so `/llms.txt` is answered by the app build — the
 * file must be a real asset there, not a route.
 *
 * Run after any change to `packages/server/src/api-v1/llms.ts`:
 *   bun run --filter @notara/app generate:llms-txt
 * `test/llms-txt-static.test.ts` fails if the committed file ever drifts.
 */
import { writeFileSync } from "node:fs";
import { llmsTxt } from "../../server/src/api-v1/llms.js";

writeFileSync(new URL("../public/llms.txt", import.meta.url), llmsTxt);
