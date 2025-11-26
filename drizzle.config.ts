import { defineConfig } from "drizzle-kit";

import { DEVELOPMENT_DATABASE_URL } from "./scripts/shared-database-url.js";

// CHANGE: Default drizzle-kit to shared Neon development database
// WHY: Align migrations with dev runtime URL injected by run-dev-with-development-db.js
// QUOTE(ТЗ): "Используй этот скрипт и везде укажи базу данных"
// REF: REQ-DEV-DATABASE-URL
// PURITY: CORE
// INVARIANT: When DATABASE_URL unset, tooling uses DEVELOPMENT_DATABASE_URL
const databaseUrl = process.env["DATABASE_URL"] ?? DEVELOPMENT_DATABASE_URL;

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/core/schema",
	out: "./drizzle",
	dbCredentials: {
		url: databaseUrl
	}
});
