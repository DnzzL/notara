import { betterAuth } from "better-auth";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { platformDb } from "./platform-db.js";
import { sendEmail, BASE_URL } from "./email.js";

export const auth = betterAuth({
  database: {
    dialect: new BunSqliteDialect({ database: platformDb }),
    type: "sqlite",
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Reset your Notara password",
        `<p>Hi ${user.name || user.email},</p>
<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${url}" style="background:#5B5EF4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
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
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
