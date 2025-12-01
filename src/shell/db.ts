import * as SqlDrizzlePg from "@effect/sql-drizzle/Pg";
import * as PgClient from "@effect/sql-pg/PgClient";
import type { SqlError } from "@effect/sql/SqlError";
import { drizzle } from "drizzle-orm/node-postgres";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Pool } from "pg";

import { DEVELOPMENT_DATABASE_URL } from "../../scripts/shared-database-url.js";
import * as schema from "../core/schema/index.js";

// CHANGE: Single database pool for Drizzle sourced from .env
// WHY: Use explicit DATABASE_URL without cross-file defaults
// PURITY: SHELL
type DbEnv = NodeJS.ProcessEnv & { readonly DATABASE_URL?: string };
const { DATABASE_URL: databaseUrl } = process.env as DbEnv;
const effectDatabaseUrl: string = databaseUrl ?? DEVELOPMENT_DATABASE_URL;

const resolveSsl = (
  url: string | undefined,
): boolean | { readonly rejectUnauthorized: boolean } => {
  if (!url) {
    return { rejectUnauthorized: false };
  }
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get("sslmode");
    const host = parsed.hostname.toLowerCase();
    const isLocal = sslMode === "disable" || host === "localhost" || host === "127.0.0.1";
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

// CHANGE: Effectful DB layers for Drizzle backed by @effect/sql-pg client
// WHY: Provide composable Effect environment for typed queries alongside existing pool
// QUOTE(ТЗ): "ЭФФЕКТНАЯ АРХИТЕКТУРА ... Effect ... Layer pattern"
// REF: AUTH-EFFECT-SQL
// PURITY: SHELL
// EFFECT: Effect<Db, SqlError, SqlClient>
// INVARIANT: Drizzle layer binds to the same DATABASE_URL (or dev fallback) as imperative pool
// COMPLEXITY: O(1) layer construction
export const PgClientLive = PgClient.layer({
  url: Redacted.make(effectDatabaseUrl),
  transformQueryNames: (value) => value,
  transformResultNames: (value) => value,
});

export const DrizzleEffectLayer = SqlDrizzlePg.layer.pipe(
  Layer.provide(PgClientLive),
);

export const runWithEffectDb = <A, E>(
  effect: Effect.Effect<A, E, SqlDrizzlePg.PgDrizzle>,
): Effect.Effect<A, E | SqlError> => Effect.provide(effect, DrizzleEffectLayer);
