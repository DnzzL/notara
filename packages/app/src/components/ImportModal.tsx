import {
	DialogBackdrop,
	DialogCloseTrigger,
	DialogContent,
	DialogDescription,
	DialogPositioner,
	DialogRoot,
	DialogTitle,
} from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { useCallback, useEffect, useRef, useState } from "react";
import { capture, captureException } from "../analytics.js";
import { restCall } from "../lib/restClient.js";
import { toaster } from "../toaster.js";
import { Button } from "./ui/index.js";

interface ImportModalProps {
	open: boolean;
	onClose: () => void;
}

/**
 * Accessible import dialog built on Ark UI's Dialog primitive. Ark handles
 * focus trapping, scroll lock, Escape-to-close, and aria wiring — we just
 * style the parts. The dialog is `controlled` via the `open` prop so the
 * parent (sidebar footer button) can drive open/close.
 */
export function ImportModal({ open, onClose }: ImportModalProps) {
	const [file, setFile] = useState<File | null>(null);
	const [status, setStatus] = useState<
		"idle" | "uploading" | "success" | "error"
	>("idle");
	const [message, setMessage] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) {
			setFile(null);
			setStatus("idle");
			setMessage("");
		}
	}, [open]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = e.target.files?.[0];
		if (selected) {
			setFile(selected);
			setStatus("idle");
			setMessage("");
		}
	};

	const handleImport = async () => {
		if (!file) return;
		setStatus("uploading");
		setMessage("Uploading and importing…");
		capture("import_started");

		try {
			// X-Workspace-Id is added by the transport.
			const data = await restCall<{
				pagesImported: number;
				databasesImported: number;
			}>("/import-notion", {
				method: "POST",
				headers: {
					"Content-Type": "application/zip",
					"Content-Disposition": `attachment; filename="${file.name}"`,
				},
				body: file,
			});
			if (data.pagesImported === 0 && data.databasesImported === 0) {
				throw new Error(
					"Nothing was imported. Make sure the export contains .md, .html, or .csv files.",
				);
			}
			capture("import_succeeded", {
				pages_imported: data.pagesImported,
				databases_imported: data.databasesImported,
			});
			setStatus("success");
			setMessage(
				`Imported ${data.pagesImported} page(s) and ${data.databasesImported} database(s).`,
			);
			toaster.create({
				title: "Import complete",
				description: `Imported ${data.pagesImported} page(s) and ${data.databasesImported} database(s).`,
				type: "success",
			});
			// Refresh so the new pages show up in the sidebar.
			setTimeout(() => window.location.reload(), 500);
		} catch (err) {
			captureException(err);
			const message = err instanceof Error ? err.message : "Import failed.";
			setStatus("idle");
			setMessage("");
			toaster.create({
				title: "Import failed",
				description: message,
				type: "error",
			});
		}
	};

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		const dropped = e.dataTransfer.files[0];
		if (dropped?.name.endsWith(".zip")) {
			setFile(dropped);
			setStatus("idle");
			setMessage("");
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	return (
		<DialogRoot
			open={open}
			onOpenChange={(details: { open: boolean }) => {
				if (!details.open && status !== "uploading") onClose();
			}}
			closeOnEscape={status !== "uploading"}
			closeOnInteractOutside={status !== "uploading"}
			lazyMount
			unmountOnExit
		>
			<Portal>
				<DialogBackdrop className="fixed inset-0 bg-[rgba(15,18,30,0.4)] backdrop-blur-[6px] z-[1000] [animation:fade-in_0.14s_var(--ease)]" />
				<DialogPositioner className="fixed inset-0 z-[1001] flex items-center justify-center p-6">
					<DialogContent className="bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-xl)] w-[480px] max-w-full overflow-hidden [animation:modal-pop_0.18s_var(--ease-spring)]">
						<div className="flex items-center justify-between px-5 py-4 border-b border-border">
							<DialogTitle className="text-[15px] font-semibold text-text">
								Import Notion export
							</DialogTitle>
							<DialogCloseTrigger
								className="bg-transparent border-none text-[17px] cursor-pointer text-text-3 p-1.5 rounded-[5px] transition-[all] duration-[var(--t)] ease-[var(--ease)] disabled:opacity-35 disabled:cursor-default hover:bg-surface-3 hover:text-text"
								disabled={status === "uploading"}
								aria-label="Close"
							>
								✕
							</DialogCloseTrigger>
						</div>

						<div className="p-5">
							{status === "idle" && (
								<>
									<DialogDescription className="text-[13.5px] text-text-2 mb-4 leading-relaxed">
										Upload your Notion export ZIP file — no need to extract it.
									</DialogDescription>

									<div
										className="import-drop-zone"
										onDrop={handleDrop}
										onDragOver={handleDragOver}
										onClick={() => fileInputRef.current?.click()}
									>
										{file ? (
											<div className="import-file-selected">
												<span className="import-file-icon">📦</span>
												<div>
													<div className="import-file-name">{file.name}</div>
													<div className="import-file-size">
														{(file.size / 1024 / 1024).toFixed(1)} MB
													</div>
												</div>
												<button
													className="import-file-remove"
													onClick={(e) => {
														e.stopPropagation();
														setFile(null);
													}}
													aria-label="Remove file"
												>
													✕
												</button>
											</div>
										) : (
											<div className="import-drop-prompt">
												<span className="import-drop-icon">📁</span>
												<div>
													Drop your ZIP file here, or{" "}
													<strong>click to browse</strong>
												</div>
											</div>
										)}
									</div>
									<input
										ref={fileInputRef}
										type="file"
										name="import-file"
										accept=".zip"
										onChange={handleFileChange}
										style={{ display: "none" }}
									/>

									<div className="flex justify-end gap-2 mt-4">
										<Button variant="secondary" onClick={onClose}>
											Cancel
										</Button>
										<Button
											variant="primary"
											onClick={handleImport}
											disabled={!file}
										>
											Import
										</Button>
									</div>
								</>
							)}

							{status === "uploading" && (
								<div className="flex flex-col items-center gap-3 py-4 text-center">
									<div className="w-8 h-8 border-[3px] border-border-mid border-t-accent rounded-full [animation:spin_0.8s_linear_infinite]" />
									<p className="text-[13.5px] text-text">{message}</p>
								</div>
							)}

							{status === "success" && (
								<div className="flex flex-col items-center gap-3 py-4 text-center">
									<span className="text-[32px] text-success">✓</span>
									<p className="text-[13.5px] text-success">{message}</p>
								</div>
							)}

							{status === "error" && (
								<div className="flex flex-col items-center gap-3 py-4 text-center">
									<span className="text-[32px] text-danger">✗</span>
									<p className="text-[13.5px] text-danger">{message}</p>
									<div className="flex justify-end gap-2 mt-2">
										<Button variant="secondary" onClick={onClose}>
											Close
										</Button>
										<Button
											variant="primary"
											onClick={() => {
												setStatus("idle");
												setMessage("");
											}}
										>
											Try again
										</Button>
									</div>
								</div>
							)}
						</div>
					</DialogContent>
				</DialogPositioner>
			</Portal>
		</DialogRoot>
	);
}
