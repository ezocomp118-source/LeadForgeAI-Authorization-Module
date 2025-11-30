import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../core/schema/index.js";

// CHANGE: Single database pool for Drizzle sourced from .env
// WHY: Use explicit DATABASE_URL without cross-file defaults
// PURITY: SHELL
type DbEnv = NodeJS.ProcessEnv & { readonly DATABASE_URL?: string };
const { DATABASE_URL: databaseUrl } = process.env as DbEnv;

const resolveSsl = (url: string | undefined) => {
	if (!url) {
		return { rejectUnauthorized: false };
	}
	try {
		const parsed = new URL(url);
		const sslMode = parsed.searchParams.get("sslmode");
		const host = parsed.hostname.toLowerCase();
		const isLocal =
			sslMode === "disable" || host === "localhost" || host === "127.0.0.1";
		return isLocal ? false : { rejectUnauthorized: false };
	} catch {
		return { rejectUnauthorized: false };
	}
};

const pool = new Pool({
	connectionString: databaseUrl,
	ssl: resolveSsl(databaseUrl),
});

export const db = drizzle(pool, { schema });
