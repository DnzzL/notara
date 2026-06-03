import { betterAuth } from "better-auth";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { platformDb } from "./platform-db.js";
import { sendEmail, BASE_URL } from "./email.js";
import { track } from "./observability.js";

const button = (label: string, url: string) =>
  `<p><a href="${url}" style="background:#5B5EF4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${label}</a></p>`;

// Email verification can be required only when SMTP is configured. Self-hosters
// with no SMTP wouldn't be able to sign anyone up otherwise.
const smtpConfigured = !!(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

export const auth = betterAuth({
  database: {
    dialect: new BunSqliteDialect({ database: platformDb }),
    type: "sqlite",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: smtpConfigured,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Reset your Notara password",
        `<p>Hi ${user.name || user.email},</p>
<p>Click the link below to reset your password. This link expires in 1 hour.</p>
${button("Reset password", url)}
<p>If you didn't request this, you can safely ignore this email.</p>
<p>— The Notara team</p>`,
      );
    },
  },
  emailVerification: {
    sendOnSignUp: smtpConfigured,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Confirm your Notara email",
        `<p>Hi ${user.name || user.email},</p>
<p>Click below to confirm your email address and finish creating your Notara account.</p>
${button("Confirm email", url)}
<p>If you didn't sign up, you can safely ignore this email.</p>
<p>— The Notara team</p>`,
      );
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          track("signup_completed", user.id, {
            email_verified: (user as any).emailVerified ?? false,
          });
          // Welcome email. Best-effort: failures must not break signup.
          try {
            await sendEmail(
              user.email,
              "Welcome to Notara",
              `<p>Hi ${user.name || user.email},</p>
<p>Welcome aboard. Notara is your second brain — yours to own, on your terms.</p>
<p>To get started, sign in and open the <strong>Getting Started</strong> page that's already waiting in your workspace.</p>
${button("Open Notara", BASE_URL)}
<p>Replying to this email reaches a real human. If you hit anything rough, let me know.</p>
<p>— The Notara team</p>`,
            );
          } catch (err) {
            console.error("welcome email failed", err);
          }
        },
      },
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
