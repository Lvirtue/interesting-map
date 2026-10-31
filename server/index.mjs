import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const production = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  next();
});

app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.static(join(root, "public"), { dotfiles: "deny", index: "index.html" }));
app.use((_request, response) => response.status(404).send("Page not found"));

if (production) {
  const https = await import("node:https");
  const certDir = join(root, "certs");
  const server = https.createServer({
    key: readFileSync(join(certDir, "key.pem")),
    cert: readFileSync(join(certDir, "cert.pem")),
  }, app);
  server.listen(port, host, () => {
    console.log(`China divisions site (HTTPS): https://${host}:${port}`);
  });
} else {
  app.listen(port, host, (error) => {
    if (error) throw error;
    console.log(`China divisions site: http://${host}:${port}`);
  });
}
