import * as Effect from "effect/Effect";
import { db } from "../db.js";
import { asDbError } from "./db-error.js";
const findUserWhere = (params) => Effect.tryPromise({
    try: () => db.query.users.findFirst(params),
    catch: (cause) => asDbError(cause),
});
export const findUserByEmail = (email) => findUserWhere({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.email, email),
});
export const findUserById = (id) => findUserWhere({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
});
