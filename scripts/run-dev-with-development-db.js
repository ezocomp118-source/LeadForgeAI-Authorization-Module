#!/usr/bin/env node

import { spawn } from "node:child_process";

// CHANGE: Ensure `npm run dev` always receives the shared Neon development DATABASE_URL.
// WHY: Manual exports caused inconsistent local runs, breaking the invariant that development instances consume the same dataset.
// QUOTE(TЗ): "Можешь создать node команду которая автмомтически подставит development_database_ur"
// REF: user-msg-2025-02-21-1
const DEVELOPMENT_DATABASE_URL =
  "postgresql://neondb_owner:npg_CLwSE1mYJha5@ep-red-truth-aedljsn0.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

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
