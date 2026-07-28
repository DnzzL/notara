import type { ApiKey, ApiKeyCreated } from "@notara/shared";
import { create } from "zustand";
import { api } from "../rpc-client.js";

export interface ApiKeyState {
	apiKeys: ApiKey[];
	apiKeysLoading: boolean;
	loadApiKeys: () => Promise<void>;
	createApiKey: (name: string) => Promise<ApiKeyCreated>;
	revokeApiKey: (id: string) => Promise<void>;
}

export const useApiKeyStore = create<ApiKeyState>((set) => ({
	apiKeys: [],
	apiKeysLoading: false,

	loadApiKeys: async () => {
		set({ apiKeysLoading: true });
		try {
			const apiKeys = await api.listApiKeys();
			set({ apiKeys });
		} finally {
			set({ apiKeysLoading: false });
		}
	},

	createApiKey: async (name) => {
		const created = await api.createApiKey({ name });
		set((s) => ({
			apiKeys: [
				{
					id: created.id,
					name: created.name,
					keyPrefix: created.keyPrefix,
					createdAt: created.createdAt,
					lastUsedAt: null,
				},
				...s.apiKeys,
			],
		}));
		return created;
	},

	revokeApiKey: async (id) => {
		await api.revokeApiKey({ id });
		set((s) => ({ apiKeys: s.apiKeys.filter((k) => k.id !== id) }));
	},
}));
