import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import nodemailer from "nodemailer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
mkdirSync(dataDir, { recursive: true });

const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3000);
const baseURL = process.env.BETTER_AUTH_URL || `http://127.0.0.1:${port}`;
const secret = process.env.BETTER_AUTH_SECRET || (production ? "" : randomBytes(32).toString("hex"));
if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
if (production && !baseURL.startsWith("https://")) {
  throw new Error("Production BETTER_AUTH_URL must use HTTPS");
}
if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("Development secret is temporary; sessions expire when the server restarts.");
}

const smtpKeys = ["SMTP_HOST", "SMTP_FROM"];
if (production && smtpKeys.some((key) => !process.env[key])) {
  throw new Error("SMTP_HOST and SMTP_FROM are required in production");
}
const smtp = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null;
if (smtp && !process.env.SMTP_FROM) throw new Error("SMTP_FROM is required when SMTP_HOST is set");

const database = new DatabaseSync(join(dataDir, "auth.sqlite"));
database.exec("PRAGMA journal_mode = WAL");

const authOptions = {
  appName: "中国行政区划",
  database,
  secret,
  baseURL,
  trustedOrigins: [new URL(baseURL).origin],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      if (!smtp) {
        console.info(`[DEV MAIL] Verification for ${user.email}: ${url}`);
        return;
      }
      void smtp.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "验证你的中国行政区划账号",
        text: `请打开以下链接验证邮箱：\n${url}\n\n如果你没有创建账号，可以忽略这封邮件。`,
      }).catch((error) => console.error("Verification email failed:", error));
    },
  },
  advanced: { useSecureCookies: production },
};

const { runMigrations } = await getMigrations(authOptions);
await runMigrations();
export const auth = betterAuth(authOptions);
