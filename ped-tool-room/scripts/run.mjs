#!/usr/bin/env node
/**
 * Single entry point behind every npm script (`dev`, `build`, `start`, `host`).
 *
 * Its whole job is to make "clone the folder, run npm install, run npm run dev"
 * work on a bare PC. Before handing over to Next.js it:
 *
 *   1. checks the Node version can run the app, and says exactly what to do if not;
 *   2. creates data/ and a .env.local with a real random session secret on first run,
 *      so nothing has to be configured by hand;
 *   3. silences the harmless "SQLite is experimental" notice Node prints on 22.x,
 *      which otherwise looks like an error to anyone starting the app.
 *
 * Written in plain ESM with no dependencies so it runs identically on Windows,
 * macOS and Linux.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- 1. Node version -------------------------------------------------------
// The database is Node's own built-in `node:sqlite`, added in 22.5.0. That is
// what removes the need for any compiler or build tools on this machine.
const MIN_NODE = "22.5.0";
const [major, minor] = process.versions.node.split(".").map(Number);

if (major < 22 || (major === 22 && minor < 5)) {
  console.error(
    [
      "",
      `  This app needs Node.js ${MIN_NODE} or newer — you are running ${process.versions.node}.`,
      "",
      "  Install the current LTS from https://nodejs.org (the big green button),",
      "  close and reopen your terminal, then run this command again.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

// --- 2. First-run setup ----------------------------------------------------
fs.mkdirSync(path.join(projectRoot, "data"), { recursive: true });

const envPath = path.join(projectRoot, ".env.local");
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(
    envPath,
    [
      "# Created automatically on first run. Safe to edit; never commit it.",
      "",
      "# Signs the login cookie. Random and unique to this installation —",
      "# changing it simply logs everyone out.",
      `JWT_SECRET=${randomBytes(32).toString("hex")}`,
      "",
      "# Leave false for plain http:// (including http://localhost and a LAN IP).",
      "# Set to true only once the app is served over https:// — a secure cookie",
      "# is dropped by the browser over plain HTTP, which looks like a broken login.",
      "COOKIE_SECURE=false",
      "",
      "# Optional email settings. Left blank, the app writes emails to",
      "# data/outbox/ instead of sending them, so nothing errors out.",
      "SMTP_HOST=",
      "SMTP_PORT=587",
      "SMTP_SECURE=false",
      "SMTP_USER=",
      "SMTP_PASS=",
      'SMTP_FROM="PED Tool Room <notifications@yourcompany.com>"',
      "",
    ].join("\n")
  );
  console.log("  Created .env.local with a fresh session secret.");
}

// --- 3. Hand over to Next.js ----------------------------------------------
// `node:sqlite` is still flagged experimental on Node 22, which prints a
// warning on every start. The feature works; only the notice is unwanted.
const nodeOptions = [process.env.NODE_OPTIONS, "--disable-warning=ExperimentalWarning"]
  .filter(Boolean)
  .join(" ");

const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error("  Could not start Next.js:", err.message);
  console.error("  Run `npm install` in this folder first.");
  process.exit(1);
});
