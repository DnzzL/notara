import type { ApiKeyCreated } from "@notara/shared";
import { useEffect, useState } from "react";
import { useApiKeyStore } from "../store.js";
import { toaster } from "../toaster.js";
import { Button } from "./ui/index.js";

export function ApiKeysPanel() {
	const { apiKeys, apiKeysLoading, loadApiKeys, createApiKey, revokeApiKey } =
		useApiKeyStore();
	const [newKeyName, setNewKeyName] = useState("");
	const [creating, setCreating] = useState(false);
	const [created, setCreated] = useState<ApiKeyCreated | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		loadApiKeys();
	}, [loadApiKeys]);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newKeyName.trim()) return;
		setCreating(true);
		try {
			const key = await createApiKey(newKeyName.trim());
			setCreated(key);
			setNewKeyName("");
		} catch (err: any) {
			toaster.create({
				title: "Failed to create key",
				description: err.message ?? "Something went wrong.",
				type: "error",
			});
		} finally {
			setCreating(false);
		}
	};

	const handleRevoke = async (id: string, name: string) => {
		if (!confirm(`Revoke "${name}"? Any scripts using it will stop working.`))
			return;
		await revokeApiKey(id);
	};

	const handleCopy = () => {
		if (created) {
			navigator.clipboard.writeText(created.rawKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<>
			<p className="text-[13.5px] text-text-2 leading-relaxed mb-4">
				Use API keys to automate Notara from scripts, CI pipelines, or any HTTP
				client. Keys authenticate as you and have access to all your workspaces.{" "}
				<a
					href="/docs"
					target="_blank"
					rel="noopener noreferrer"
					className="text-accent no-underline font-medium hover:opacity-75"
				>
					API docs ↗
				</a>
			</p>

			{created && (
				<div className="bg-[rgba(22,163,74,0.06)] border border-[rgba(22,163,74,0.25)] rounded p-3.5 mb-4">
					<div className="flex items-center justify-between mb-2.5">
						<span className="text-[13px] font-semibold text-success">
							✓ Key created — copy it now, it won't be shown again
						</span>
						<button
							className="bg-transparent border-none cursor-pointer text-text-3 text-sm px-0.5"
							onClick={() => setCreated(null)}
						>
							✕
						</button>
					</div>
					<div className="flex gap-2 items-center">
						<code className="flex-1 [font-family:var(--font-mono)] text-[12.5px] bg-surface-2 border border-border rounded-lg px-2.5 py-[7px] text-text overflow-hidden text-ellipsis whitespace-nowrap block">
							{created.rawKey}
						</code>
						<Button variant="primary" size="sm" onClick={handleCopy}>
							{copied ? "Copied!" : "Copy"}
						</Button>
					</div>
				</div>
			)}

			<section className="mb-5">
				<h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">
					New key
				</h3>
				<form className="flex gap-1.5" onSubmit={handleCreate}>
					<input
						type="text"
						name="api-key-name"
						placeholder="Key name (e.g. CI pipeline)"
						value={newKeyName}
						onChange={(e) => setNewKeyName(e.target.value)}
						className="flex-1 px-2.5 py-[7px] border border-border rounded-lg text-[12px] [font-family:var(--font-mono)] bg-surface-2 text-text outline-none"
						maxLength={64}
					/>
					<Button
						type="submit"
						variant="primary"
						size="sm"
						disabled={creating || !newKeyName.trim()}
					>
						{creating ? "Creating…" : "Create"}
					</Button>
				</form>
			</section>

			<section className="mb-5">
				<h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">
					Active keys
				</h3>
				{apiKeysLoading ? (
					<p className="text-text-3 text-sm">Loading…</p>
				) : apiKeys.length === 0 ? (
					<div className="flex flex-col items-center text-center px-4 pt-7 pb-3 [animation:empty-state-in_0.4s_var(--ease-spring)]">
						<div
							className="mb-4 [filter:drop-shadow(0_4px_12px_rgba(43,77,255,0.12))]"
							aria-hidden="true"
						>
							<svg width="56" height="56" viewBox="0 0 56 56" fill="none">
								<rect
									x="4"
									y="4"
									width="48"
									height="48"
									rx="14"
									fill="#E7EBFF"
								/>
								<circle
									cx="22"
									cy="24"
									r="8"
									stroke="#2B4DFF"
									strokeWidth="2"
									fill="none"
								/>
								<circle cx="22" cy="24" r="3" fill="#2B4DFF" opacity="0.3" />
								<path
									d="M28 30l10 10"
									stroke="#2B4DFF"
									strokeWidth="2.5"
									strokeLinecap="round"
								/>
								<path
									d="M35 37l3-1.5 1 2.5"
									stroke="#2B4DFF"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</div>
						<p className="[font-family:var(--font-title)] text-[17px] font-bold text-text tracking-[-0.02em] mb-1.5">
							No keys yet
						</p>
						<p className="text-[13.5px] text-text-3 leading-relaxed max-w-[280px]">
							Create a key above to start automating Notara from scripts or CI
							pipelines.
						</p>
					</div>
				) : (
					<ul className="list-none m-0 p-0 flex flex-col gap-0.5">
						{apiKeys.map((k) => (
							<li
								key={k.id}
								className="flex flex-col gap-1 px-3.5 py-3 border border-border rounded bg-surface"
							>
								<div className="flex items-center gap-2.5">
									<span className="font-semibold text-sm text-text">
										{k.name}
									</span>
									<code className="[font-family:var(--font-mono)] text-[12px] bg-surface-3 rounded px-1.5 py-0.5 text-text-3">
										{k.keyPrefix}…
									</code>
								</div>
								<div className="flex items-center justify-between gap-2">
									<span className="text-[12px] text-text-3">
										Created {new Date(k.createdAt).toLocaleDateString()}
										{k.lastUsedAt &&
											` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
									</span>
									<Button
										variant="danger"
										size="sm"
										onClick={() => handleRevoke(k.id, k.name)}
									>
										Revoke
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</>
	);
}
