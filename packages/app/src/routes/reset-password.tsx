import { createRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../auth-client.js";
import { Field } from "../components/ui/index.js";
import { toaster } from "../toaster.js";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/reset-password",
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token } = useSearch({ from: "/reset-password" });
	const navigate = useNavigate();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (password !== confirm) {
			toaster.create({
				title: "Passwords don't match",
				description: "Make sure both fields are identical.",
				type: "error",
			});
			return;
		}
		if (password.length < 8) {
			toaster.create({
				title: "Password too short",
				description: "Your password must be at least 8 characters.",
				type: "error",
			});
			return;
		}
		setLoading(true);
		try {
			const result = await authClient.resetPassword({
				newPassword: password,
				token,
			});
			if (result.error) {
				toaster.create({
					title: "Reset failed",
					description: result.error.message ?? "Something went wrong.",
					type: "error",
				});
				return;
			}
			setDone(true);
			setTimeout(() => navigate({ to: "/login" }), 2000);
		} catch (err: any) {
			toaster.create({
				title: "Reset failed",
				description: err.message ?? "Something went wrong.",
				type: "error",
			});
		} finally {
			setLoading(false);
		}
	};

	if (!token) {
		return (
			<div className="auth-page">
				<div className="auth-card">
					<div className="auth-heading">
						<h1>Invalid link</h1>
						<p className="auth-subheading">
							This reset link is missing a token. Please request a new one.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="auth-page">
			<div className="auth-card">
				<div className="auth-brand">
					<div className="auth-brand-icon">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<rect
								x="2"
								y="2"
								width="7"
								height="7"
								rx="2"
								fill="currentColor"
								opacity="0.9"
							/>
							<rect
								x="11"
								y="2"
								width="7"
								height="7"
								rx="2"
								fill="currentColor"
								opacity="0.5"
							/>
							<rect
								x="2"
								y="11"
								width="7"
								height="7"
								rx="2"
								fill="currentColor"
								opacity="0.5"
							/>
							<rect
								x="11"
								y="11"
								width="7"
								height="7"
								rx="2"
								fill="currentColor"
								opacity="0.25"
							/>
						</svg>
					</div>
					<span className="auth-brand-name">Notara</span>
				</div>

				<div className="auth-heading">
					<h1>New password</h1>
					<p className="auth-subheading">
						{done
							? "Password updated! Redirecting to sign in…"
							: "Choose a new password for your account."}
					</p>
				</div>

				{!done && (
					<form className="auth-form" onSubmit={handleSubmit}>
						<Field label="New password" htmlFor="new-password">
							<input
								id="new-password"
								type="password"
								placeholder="At least 8 characters"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="new-password"
							/>
						</Field>
						<Field label="Confirm password" htmlFor="confirm-password">
							<input
								id="confirm-password"
								type="password"
								placeholder="Same password again"
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								required
								autoComplete="new-password"
							/>
						</Field>
						<button type="submit" className="auth-submit" disabled={loading}>
							{loading ? <span className="auth-spinner" /> : "Update password"}
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
