import * as SqlDrizzlePg from "@effect/sql-drizzle/Pg";
import * as PgClient from "@effect/sql-pg/PgClient";
import type { SqlError } from "@effect/sql/SqlError";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Pool } from "pg";
import * as schema from "../core/schema/index.js";
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: Pool;
};
export declare const PgClientLive: Layer.Layer<import("@effect/sql/SqlClient").SqlClient | PgClient.PgClient, SqlError, never>;
export declare const DrizzleEffectLayer: Layer.Layer<SqlDrizzlePg.PgDrizzle, SqlError, never>;
export declare const runWithEffectDb: <A, E>(effect: Effect.Effect<A, E, SqlDrizzlePg.PgDrizzle>) => Effect.Effect<A, E | SqlError>;
