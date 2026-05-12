// Simple fetch-based RPC client for the Effect RPC HTTP server
// The Effect RPC server accepts POST requests with JSON body
// Format: { _tag: "Request", id: <number>, method: <name>, payload: <object>, successSchemaId, errorSchemaId }

// Use relative URL so Vite dev server can proxy to backend
const API_URL = "/api";

let nextId = 1;

async function rpcCall(method: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  const id = String(nextId++);
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _tag: "Request",
      id,
      tag: method,
      payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed: ${response.status} ${response.statusText}`);
  }

  const results = await response.json();
  const result = results.find((r: any) => r.requestId === id);
  if (!result) throw new Error(`RPC ${method}: no response for id ${id}`);

  if (result._tag === "Exit" && result.exit._tag === "Failure") {
    throw new Error(`RPC ${method} error: ${JSON.stringify(result.exit.cause)}`);
  }

  return result.exit.value;
}

export const api = {
  listPages: () => rpcCall("listPages", {}) as Promise<any[]>,
  getPage: (id: string) => rpcCall("getPage", { id }) as Promise<any | null>,
  createPage: (title: string, parentId: string | null = null) =>
    rpcCall("createPage", { title, parentId }) as Promise<any>,
  updatePage: (id: string, title: string) => rpcCall("updatePage", { id, title }) as Promise<any>,
  deletePage: (id: string) => rpcCall("deletePage", { id }) as Promise<void>,
  searchPages: (query: string) => rpcCall("searchPages", { query }) as Promise<any[]>,

  listBlocks: (pageId: string) => rpcCall("listBlocks", { pageId }) as Promise<any[]>,
  createBlock: (req: { pageId: string; type: string; content: string; index: number; parentId?: string | null }) =>
    rpcCall("createBlock", req) as Promise<any>,
  updateBlock: (id: string, content: string) => rpcCall("updateBlock", { id, content }) as Promise<any>,
  deleteBlock: (id: string) => rpcCall("deleteBlock", { id }) as Promise<void>,
  reorderBlocks: (pageId: string, blockIds: string[]) =>
    rpcCall("reorderBlocks", { pageId, blockIds }) as Promise<any[]>,

  listDatabases: (pageId: string) => rpcCall("listDatabases", { pageId }) as Promise<any[]>,
  getDatabase: (id: string) => rpcCall("getDatabase", { id }) as Promise<any>,
  createDatabase: (pageId: string, name: string) =>
    rpcCall("createDatabase", { pageId, name }) as Promise<any>,
  listFields: (databaseId: string) => rpcCall("listFields", { databaseId }) as Promise<any[]>,
  createField: (req: any) => rpcCall("createField", req) as Promise<any>,
  listRecords: (databaseId: string) => rpcCall("listRecords", { databaseId }) as Promise<any[]>,
  getRecordWithValues: (recordId: string) =>
    rpcCall("getRecordWithValues", { recordId }) as Promise<any>,
  createRecord: (databaseId: string, title: string) =>
    rpcCall("createRecord", { databaseId, title }) as Promise<any>,
  updateFieldValue: (recordId: string, fieldId: string, value: string) =>
    rpcCall("updateFieldValue", { recordId, fieldId, value }) as Promise<any>,
  deleteRecord: (id: string) => rpcCall("deleteRecord", { id }) as Promise<void>,
  listViews: (databaseId: string) => rpcCall("listViews", { databaseId }) as Promise<any[]>,
  createView: (req: any) => rpcCall("createView", req) as Promise<any>,
};
