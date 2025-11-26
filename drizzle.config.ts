import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost:5432/leadforge";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/core/schema",
	out: "./drizzle",
	dbCredentials: {
		url: databaseUrl
	}
});
