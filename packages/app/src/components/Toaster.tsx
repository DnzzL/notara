import { Portal } from "@ark-ui/react/portal";
import {
	Toaster as ArkToaster,
	Toast,
	ToastActionTrigger,
	type ToastOptions,
} from "@ark-ui/react/toast";
import { toaster } from "../toaster.js";

function CheckIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="9" cy="9" r="9" fill="var(--success)" opacity="0.12" />
			<path
				d="M5.5 9.5l2.5 2.5 4.5-4.5"
				stroke="var(--success)"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ErrorIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="9" cy="9" r="9" fill="var(--danger)" opacity="0.12" />
			<path
				d="M6 6l6 6M12 6l-6 6"
				stroke="var(--danger)"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function WarningIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="9" cy="9" r="9" fill="var(--warning)" opacity="0.12" />
			<path
				d="M9 6v4"
				stroke="var(--warning)"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
			<circle cx="9" cy="12.5" r="0.9" fill="var(--warning)" />
		</svg>
	);
}

function InfoIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="9" cy="9" r="9" fill="var(--accent)" opacity="0.12" />
			<path
				d="M9 8v4"
				stroke="var(--accent)"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
			<circle cx="9" cy="5.5" r="0.9" fill="var(--accent)" />
		</svg>
	);
}

function ToastIcon({ type }: { type: string }) {
	if (type === "success") return <CheckIcon />;
	if (type === "error") return <ErrorIcon />;
	if (type === "warning") return <WarningIcon />;
	return <InfoIcon />;
}

export function Toaster() {
	return (
		<Portal>
			<ArkToaster toaster={toaster} className="toast-group">
				{(toast: ToastOptions) => (
					<Toast.Root
						key={toast.id}
						className={`toast toast--${toast.type ?? "info"}`}
					>
						<span className="toast-icon">
							<ToastIcon type={toast.type ?? "info"} />
						</span>
						<div className="toast-body">
							{toast.title && (
								<Toast.Title className="toast-title">{toast.title}</Toast.Title>
							)}
							{toast.description && (
								<Toast.Description className="toast-description">
									{toast.description}
								</Toast.Description>
							)}
						</div>
						{toast.action && (
							<ToastActionTrigger className="toast-action">
								{toast.action.label}
							</ToastActionTrigger>
						)}
						<Toast.CloseTrigger className="toast-close" aria-label="Dismiss">
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M2 2l8 8M10 2l-8 8"
									stroke="currentColor"
									strokeWidth="1.6"
									strokeLinecap="round"
								/>
							</svg>
						</Toast.CloseTrigger>
					</Toast.Root>
				)}
			</ArkToaster>
		</Portal>
	);
}
