import { restCall } from "./lib/restClient.js";

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

export async function uploadFile(
	pageId: string,
	file: File,
): Promise<UploadResult> {
	const buffer = await file.arrayBuffer();
	const headers: Record<string, string> = {
		"Content-Type": file.type || "application/octet-stream",
		"X-Page-Id": pageId,
		"X-File-Name": encodeURIComponent(file.name),
	};
	// X-Workspace-Id is added by the transport.
	return await restCall<UploadResult>("/api/upload", {
		method: "POST",
		headers,
		body: buffer,
	});
}

export function isUploadable(_file: File): boolean {
	return true;
}
