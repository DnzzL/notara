/**
 * `/api/v1` is frozen: changes are additive only (docs/api-policy.md).
 *
 * The live OpenAPI document is compared to a committed snapshot. A breaking
 * change fails; an additive one passes. After an intentional, additive change,
 * refresh the snapshot:
 *
 *   UPDATE_OPENAPI_SNAPSHOT=1 bun test packages/server/test/openapi-breaking.test.ts
 *
 * Not a general JSON-schema differ: a few rules, each one a way an integrator's
 * script or agent stops working.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { spec } from "../src/api-v1/openapi.js";

const SNAPSHOT = new URL("./fixtures/openapi.snapshot.json", import.meta.url);

type Json = any;

const METHODS = ["get", "put", "post", "delete", "patch"];

/**
 * Everything in `before` that `after` no longer honours. Empty = additive only.
 * `request` schemas must not gain required input; `response` schemas must not
 * lose fields or guarantees.
 */
const breakingChanges = (before: Json, after: Json): string[] => {
	const out: string[] = [];
	const deref = (doc: Json, s: Json): Json => {
		let cur = s;
		while (cur?.$ref) {
			cur = cur.$ref
				.slice(2)
				.split("/")
				.reduce((o: Json, k: string) => o?.[k], doc);
		}
		return cur;
	};

	const schema = (
		b: Json,
		a: Json,
		where: string,
		role: "request" | "response",
		seen = new Set<string>(),
	): void => {
		const key = `${b?.$ref}|${a?.$ref}`;
		if (b?.$ref && seen.has(key)) return;
		if (b?.$ref) seen.add(key);
		b = deref(before, b);
		a = deref(after, a);
		if (!b) return;
		if (!a) return void out.push(`${where}: schema removed`);

		if (b.anyOf) {
			// each old alternative must still be accepted by some new alternative
			for (const [i, alt] of b.anyOf.entries()) {
				const options = a.anyOf ?? [a];
				const fits = options.some((o: Json) => {
					const probe: string[] = [];
					const saved = out.length;
					schema(alt, o, where, role, new Set(seen));
					probe.push(...out.splice(saved));
					return probe.length === 0;
				});
				if (!fits) out.push(`${where}: alternative #${i} no longer matches`);
			}
			return;
		}
		if (a.anyOf) {
			// old single schema → new union: fine if one branch still fits it
			const saved = out.length;
			const fits = a.anyOf.some((o: Json) => {
				schema(b, o, where, role, new Set(seen));
				return out.splice(saved).length === 0;
			});
			if (!fits) out.push(`${where}: type changed`);
			return;
		}

		if (b.type !== a.type) {
			out.push(`${where}: type ${b.type} → ${a.type}`);
			return;
		}
		if (b.enum && a.enum)
			for (const v of b.enum)
				if (!a.enum.includes(v)) out.push(`${where}: enum value ${v} removed`);

		const bReq: string[] = b.required ?? [];
		const aReq: string[] = a.required ?? [];
		if (role === "request")
			for (const r of aReq)
				if (!bReq.includes(r)) out.push(`${where}: new required input ${r}`);
		if (role === "response")
			for (const r of bReq)
				if (!aReq.includes(r)) out.push(`${where}: ${r} no longer guaranteed`);

		for (const [name, prop] of Object.entries<Json>(b.properties ?? {})) {
			if (!a.properties?.[name]) out.push(`${where}: field ${name} removed`);
			else schema(prop, a.properties[name], `${where}.${name}`, role, seen);
		}
		if (b.items && a.items) schema(b.items, a.items, `${where}[]`, role, seen);
	};

	const body = (
		b: Json,
		a: Json,
		where: string,
		role: "request" | "response",
	) => {
		const bs = b?.content?.["application/json"]?.schema;
		if (!bs) return;
		const as = a?.content?.["application/json"]?.schema;
		if (!as) return void out.push(`${where}: JSON body removed`);
		schema(bs, as, where, role);
	};

	for (const [path, bItem] of Object.entries<Json>(before.paths)) {
		const aItem = after.paths?.[path];
		if (!aItem) {
			out.push(`${path}: path removed`);
			continue;
		}
		const pKey = (p: Json) => `${p.in}:${p.name}`;
		for (const m of METHODS) {
			const bOp = bItem[m];
			if (!bOp) continue;
			const id = `${m.toUpperCase()} ${path}`;
			const aOp = aItem[m];
			if (!aOp) {
				out.push(`${id}: operation removed`);
				continue;
			}
			const bParams = [...(bItem.parameters ?? []), ...(bOp.parameters ?? [])];
			const aParams = [...(aItem.parameters ?? []), ...(aOp.parameters ?? [])];
			for (const p of aParams) {
				const old = bParams.find((q) => pKey(q) === pKey(p));
				if (p.required && !old?.required)
					out.push(`${id}: new required ${p.in} parameter ${p.name}`);
				if (old) schema(old.schema, p.schema, `${id} ${pKey(p)}`, "request");
			}
			if (aOp.requestBody?.required && !bOp.requestBody?.required)
				out.push(`${id}: request body now required`);
			body(bOp.requestBody, aOp.requestBody, `${id} request`, "request");
			for (const [status, bRes] of Object.entries<Json>(bOp.responses ?? {})) {
				if (!aOp.responses?.[status])
					out.push(`${id}: response ${status} removed`);
				else body(bRes, aOp.responses[status], `${id} ${status}`, "response");
			}
		}
	}
	return out;
};

const live = (): Json => JSON.parse(JSON.stringify(spec));

if (process.env.UPDATE_OPENAPI_SNAPSHOT) {
	writeFileSync(SNAPSHOT, `${JSON.stringify(live(), null, "\t")}\n`);
}
const snapshot: Json = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

describe("/api/v1 contract (docs/api-policy.md)", () => {
	test("live document keeps everything the snapshot promised", () => {
		expect(breakingChanges(snapshot, live())).toEqual([]);
	});

	describe("the diff itself", () => {
		const firstOp = (doc: Json, method: string, needle: string) => {
			const path = Object.keys(doc.paths).find(
				(p) => doc.paths[p][method] && p.includes(needle),
			);
			if (!path) throw new Error(`no ${method} ${needle}`);
			return { path, op: doc.paths[path][method] };
		};
		const mutate = (f: (doc: Json) => void): string[] => {
			const doc = live();
			f(doc);
			return breakingChanges(snapshot, doc);
		};
		const okSchema = (doc: Json) => doc.components.schemas.Page;

		test("additive changes pass", () => {
			expect(
				mutate((d) => {
					d.paths["/brand-new"] = { get: { responses: {} } };
					okSchema(d).properties.extraField = { type: "string" };
					okSchema(d).required.push("extraField");
					const { op } = firstOp(d, "post", "/pages");
					op.parameters = [
						...(op.parameters ?? []),
						{ name: "q", in: "query", schema: { type: "string" } },
					];
					op.deprecated = true;
				}),
			).toEqual([]);
		});

		test("removed path, operation, response field", () => {
			expect(
				mutate((d) => {
					delete d.paths["/workspaces"];
				}),
			).toContain("/workspaces: path removed");
			expect(
				mutate((d) => {
					delete d.paths["/workspaces/{workspaceId}/pages/{pageId}"].delete;
				}).join(),
			).toContain(
				"DELETE /workspaces/{workspaceId}/pages/{pageId}: operation removed",
			);
			expect(
				mutate((d) => {
					delete okSchema(d).properties.title;
				}).join(),
			).toContain("field title removed");
		});

		test("narrowed type", () => {
			expect(
				mutate((d) => {
					okSchema(d).properties.title = { type: "number" };
				}).join(),
			).toContain("title");
		});

		test("new required input", () => {
			expect(
				mutate((d) => {
					const { op } = firstOp(d, "post", "/pages");
					const s = op.requestBody.content["application/json"].schema;
					s.properties.brandNew = { type: "string" };
					s.required = [...(s.required ?? []), "brandNew"];
				}).join(),
			).toContain("new required input brandNew");
			expect(
				mutate((d) => {
					const { op } = firstOp(d, "get", "/pages/{pageId}");
					op.parameters = [
						...(op.parameters ?? []),
						{
							name: "must",
							in: "query",
							required: true,
							schema: { type: "string" },
						},
					];
				}).join(),
			).toContain("new required query parameter must");
		});

		test("removed enum value", () => {
			const found = JSON.stringify(snapshot).includes('"enum"');
			expect(found).toBe(true);
			const dropEnum = (x: Json): boolean => {
				if (x && typeof x === "object") {
					if (Array.isArray(x.enum) && x.enum.length > 1) {
						x.enum.pop();
						return true;
					}
					return Object.values(x).some(dropEnum);
				}
				return false;
			};
			const problems = mutate((d) => {
				dropEnum(d.components.schemas) || dropEnum(d.paths);
			});
			expect(problems.join()).toContain("enum value");
		});
	});
});
