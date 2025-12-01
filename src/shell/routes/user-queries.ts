import * as Effect from "effect/Effect";

import type { users } from "../../core/schema/index.js";
import { db } from "../db.js";
import { asDbError, type DbError, type ErrorCause } from "./db-error.js";

type UserFindParams = Parameters<(typeof db.query.users)["findFirst"]>[0];

export type UserRow = typeof users.$inferSelect;

const findUserWhere = (params: UserFindParams): Effect.Effect<UserRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () => db.query.users.findFirst(params),
    catch: (cause) => asDbError(cause as ErrorCause),
  });

export const findUserByEmail = (
  email: string,
): Effect.Effect<UserRow | undefined, DbError> =>
  findUserWhere({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.email, email),
  });

export const findUserById = (
  id: string,
): Effect.Effect<UserRow | undefined, DbError> =>
  findUserWhere({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
  });
