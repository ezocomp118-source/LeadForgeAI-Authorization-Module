import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../core/schema/index.js";

// CHANGE: Single database pool for Drizzle
// WHY: Provide reusable connection across shell routes/services
// PURITY: SHELL
const { DATABASE_URL: databaseUrl } = process.env;

const pool = new Pool({
	connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });
