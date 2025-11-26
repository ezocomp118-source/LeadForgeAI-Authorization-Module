#!/usr/bin/env node

import { spawn } from "node:child_process";

import { DEVELOPMENT_DATABASE_URL } from "./shared-database-url.js";

// CHANGE: Ensure `npm run dev` always receives the shared Neon development DATABASE_URL.
// WHY: Manual exports caused inconsistent local runs, breaking the invariant that development instances consume the same dataset.
// QUOTE(ТЗ): "Используй этот скрипт и везде укажи базу данных"
// REF: REQ-DEV-DATABASE-URL

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const child = spawn(npmCommand, ["run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: DEVELOPMENT_DATABASE_URL,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
