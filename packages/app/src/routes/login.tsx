import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { capture, captureException } from "../analytics.js";
import { authClient, signIn, signUp } from "../auth-client.js";
import { Field } from "../components/ui/index.js";
import { toaster } from "../toaster.js";
import { Route as rootRoute } from "./__root.js";

export const Route = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: LoginPage,
});

function GoogleIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
				fill="#4285F4"
			/>
			<path
				d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
				fill="#34A853"
			/>
			<path
				d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
				fill="#FBBC05"
			/>
			<path
				d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
				fill="#EA4335"
			/>
		</svg>
	);
}

function LoginPage() {
	const navigate = useNavigate();
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(false);
	const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
	const [resending, setResending] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setUnverifiedEmail(null);
		try {
			const result =
				mode === "login"
					? await signIn.email({ email, password })
					: await signUp.email({ email, password, name });
			if (result.error) {
				const unverified = result.error.code === "EMAIL_NOT_VERIFIED";
				if (unverified) setUnverifiedEmail(email);
				toaster.create({
					title: unverified
						? "Confirm your email first"
						: mode === "login"
							? "Sign in failed"
							: "Registration failed",
					description: unverified
						? "We just emailed you a confirmation link — click it, then sign in again."
						: (result.error.message ?? "Something went wrong."),
					type: "error",
				});
				return;
			}
			capture("sign_in_succeeded", { method: "email", mode });
			navigate({ to: "/workspaces" });
		} catch (err: any) {
			captureException(err);
			toaster.create({
				title: mode === "login" ? "Sign in failed" : "Registration failed",
				description: err.message ?? "Something went wrong.",
				type: "error",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleGoogle = async () => {
		capture("sign_in_succeeded", { method: "google", mode: "login" });
		await signIn.social({ provider: "google", callbackURL: "/workspaces" });
	};

	const handleResend = async () => {
		if (!unverifiedEmail) return;
		setResending(true);
		try {
			await authClient.sendVerificationEmail({
				email: unverifiedEmail,
				callbackURL: "/workspaces",
			});
			toaster.create({
				title: "Email sent",
				description: `A new confirmation link is on its way to ${unverifiedEmail}.`,
				type: "success",
			});
		} finally {
			setResending(false);
		}
	};

	const isLogin = mode === "login";

	return (
		<div className="auth-page">
			<div className="auth-card">
				{/* Brand mark */}
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
					<h1>{isLogin ? "Welcome back" : "Create an account"}</h1>
					<p className="auth-subheading">
						{isLogin
							? "Sign in to your workspace"
							: "Start writing. Everything stays organized."}
					</p>
				</div>

				{/* Google OAuth */}
				<button type="button" className="oauth-btn" onClick={handleGoogle}>
					<GoogleIcon />
					Continue with Google
				</button>

				<div className="auth-divider">
					<span>or continue with email</span>
				</div>

				<form className="auth-form" onSubmit={handleSubmit}>
					{!isLogin && (
						<Field label="Full name" htmlFor="auth-name">
							<input
								id="auth-name"
								type="text"
								placeholder="Ada Lovelace"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								autoComplete="name"
							/>
						</Field>
					)}
					<Field label="Email" htmlFor="auth-email">
						<input
							id="auth-email"
							type="email"
							placeholder="you@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							autoComplete="email"
						/>
					</Field>
					<Field
						label="Password"
						htmlFor="auth-password"
						accessory={
							isLogin ? (
								<Link to="/forgot-password" className="auth-forgot-link">
									Forgot password?
								</Link>
							) : undefined
						}
					>
						<input
							id="auth-password"
							type="password"
							placeholder={isLogin ? "Your password" : "At least 8 characters"}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							autoComplete={isLogin ? "current-password" : "new-password"}
						/>
					</Field>

					<button type="submit" className="auth-submit" disabled={loading}>
						{loading ? (
							<span className="auth-spinner" />
						) : isLogin ? (
							"Sign in"
						) : (
							"Create account"
						)}
					</button>
				</form>

				{unverifiedEmail && (
					<p className="auth-footer">
						Didn't get the email?{" "}
						<button
							type="button"
							className="auth-toggle"
							onClick={handleResend}
							disabled={resending}
						>
							{resending ? "Sending…" : "Resend confirmation link"}
						</button>
					</p>
				)}

				<p className="auth-footer">
					{isLogin ? "New here?" : "Already have an account?"}{" "}
					<button
						type="button"
						className="auth-toggle"
						onClick={() => setMode(isLogin ? "register" : "login")}
					>
						{isLogin ? "Create an account" : "Sign in"}
					</button>
				</p>
			</div>
		</div>
	);
}
