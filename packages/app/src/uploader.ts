import { getCurrentWorkspaceId } from "./rpc-client.js";

/**
 * Upload a file to the server. Returns the created block's metadata.
 * Sends raw bytes with metadata in headers (Content-Type, X-Page-Id, X-File-Name).
 */
export interface UploadResult {
  blockId: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

export async function uploadFile(pageId: string, file: File): Promise<UploadResult> {
  const buffer = await file.arrayBuffer();
  const headers: Record<string, string> = {
    "Content-Type": file.type || "application/octet-stream",
    "X-Page-Id": pageId,
    "X-File-Name": encodeURIComponent(file.name),
  };
  const workspaceId = getCurrentWorkspaceId();
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }
  const res = await fetch("/api/upload", {
    method: "POST",
    headers,
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }

  return await res.json();
}

export function isUploadable(_file: File): boolean {
  return true;
}
