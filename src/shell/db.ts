import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../core/schema/index.js";

// CHANGE: Single database pool for Drizzle sourced from .env
// WHY: Use explicit DATABASE_URL without cross-file defaults
// PURITY: SHELL
type DbEnv = NodeJS.ProcessEnv & { readonly DATABASE_URL?: string };
const { DATABASE_URL: databaseUrl } = process.env as DbEnv;

const pool = new Pool({
	connectionString: databaseUrl,
	ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
