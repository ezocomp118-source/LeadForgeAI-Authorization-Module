import bcrypt from "bcryptjs";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { type LoginCandidate, parseLogin } from "./auth-helpers.js";
import type { DbError } from "./db-error.js";
import { findUserByEmail, findUserById, type UserRow } from "./user-queries.js";

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
