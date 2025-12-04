import * as Effect from "effect/Effect";
import type { users } from "../../core/schema/index.js";
import { type DbError } from "./db-error.js";
export type UserRow = typeof users.$inferSelect;
export declare const findUserByEmail: (email: string) => Effect.Effect<UserRow | undefined, DbError>;
export declare const findUserById: (id: string) => Effect.Effect<UserRow | undefined, DbError>;
