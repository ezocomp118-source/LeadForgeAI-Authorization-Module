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
	// CHANGE: Use built schema artifacts as single source of truth for migrations
	// WHY: Align drizzle-kit with distributable schema consumed by downstream apps (dist/core/schema/index.js)
	// QUOTE(ТЗ): "будем использовать только схему модуля (dist/core/schema/index.js) в Drizzle."
	// REF: AUTH-SCHEMA-SOURCE
	// PURITY: CORE
	// INVARIANT: Migrations derive from emitted schema, avoiding .ts extension resolution drift
	schema: "./dist/core/schema/index.js",
	out: "./drizzle",
	dbCredentials: {
		url: databaseUrl
	}
});
