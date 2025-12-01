import bcrypt from "bcryptjs";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { users } from "../../core/schema/index.js";
import { db } from "../db.js";
import { type LoginCandidate, parseLogin } from "./auth-helpers.js";

type UserRow = typeof users.$inferSelect;
type ErrorCause =
  | Error
  | { readonly message?: string }
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;
type DbError = { readonly _tag: "DbError"; readonly cause: Error };
type AuthError = DbError | { readonly _tag: "InvalidCredentials" };

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.session.userId) {
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized" });
};

const respondError = (res: Response, status: number, error: string): void => {
  res.status(status).json({ error });
};

const toUserPayload = (user: UserRow): {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly profileImageUrl: string | null;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
} => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  profileImageUrl: user.profileImageUrl ?? null,
  emailVerified: user.emailVerifiedAt !== null,
  phoneVerified: user.phoneVerifiedAt !== null,
});

const verifyPassword = (password: string, passwordHash: string): boolean => bcrypt.compareSync(password, passwordHash);

const hasMessage = (value: ErrorCause): value is { readonly message: string } =>
  typeof value === "object"
  && value !== null
  && "message" in value
  && typeof (value as { readonly message?: string }).message === "string";

const serializeCause = (value: ErrorCause): string => {
  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
    || typeof value === "symbol"
  ) {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  return typeof serialized === "string" ? serialized : "unknown_error";
};

const asDbError = (cause: ErrorCause): DbError =>
  cause instanceof Error
    ? { _tag: "DbError", cause }
    : hasMessage(cause)
    ? { _tag: "DbError", cause: new Error(cause.message) }
    : { _tag: "DbError", cause: new Error(serializeCause(cause)) };

const findUserByEmail = (
  email: string,
): Effect.Effect<UserRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () =>
      db.query.users.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.email, email),
      }),
    catch: (cause) => asDbError(cause as ErrorCause),
  });

const findUserById = (
  id: string,
): Effect.Effect<UserRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () =>
      db.query.users.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
      }),
    catch: (cause) => asDbError(cause as ErrorCause),
  });

export const postLogin: RequestHandler = (req, res, next) => {
  const payload = parseLogin(req.body as LoginCandidate);
  if (!payload) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const program = pipe(
    findUserByEmail(payload.email.toLowerCase()),
    Effect.flatMap((user) =>
      user
        ? verifyPassword(payload.password, user.passwordHash)
          ? Effect.sync(() => {
            req.session.userId = user.id;
            res.json(toUserPayload(user));
          })
          : Effect.fail<AuthError>({ _tag: "InvalidCredentials" })
        : Effect.fail<AuthError>({ _tag: "InvalidCredentials" })
    ),
    Effect.catchAll((err) =>
      err._tag === "InvalidCredentials"
        ? Effect.sync(() => {
          respondError(res, 401, "invalid_credentials");
        })
        : Effect.sync(() => {
          next(err.cause);
        })
    ),
  );
  Effect.runPromise(program).catch(next);
};

export const postLogout: RequestHandler = (req, res) => {
  const handleDestroy = (err: Error | null): void => {
    if (err) {
      res.status(500).json({ error: "logout_failed" });
      return;
    }
    res.status(204).end();
  };
  req.session.destroy(handleDestroy);
};

export const getMe: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const program = pipe(
    findUserById(req.session.userId),
    Effect.flatMap((user) =>
      user
        ? Effect.sync(() => {
          res.json(toUserPayload(user));
        })
        : Effect.sync(() => {
          res.status(404).json({ error: "user_not_found" });
        })
    ),
    Effect.catchAll((err) =>
      Effect.sync(() => {
        next(err.cause);
      })
    ),
  );
  Effect.runPromise(program).catch(next);
};
