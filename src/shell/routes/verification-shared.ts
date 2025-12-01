import { randomBytes } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { Request, Response } from "express";
import { match } from "ts-pattern";

import { users, type VerificationCodeRow, verificationCodes } from "../../core/schema/index.js";
import {
  evaluateAttempt,
  hashVerificationToken,
  isRateLimited,
  type VerificationAttemptOutcome,
} from "../../core/verification.js";
import { db } from "../db.js";
import { config, verificationMessages, verificationRequiredMessage } from "./verification-config.js";

export type VerificationErrorCode =
  | "code_invalid"
  | "code_expired"
  | "too_many_attempts"
  | "rate_limited";

export type VerificationType = VerificationCodeRow["type"];

export type VerificationRequestResponse = {
  readonly status: "ok";
  readonly alreadyVerified?: boolean;
  readonly emailVerified?: boolean;
  readonly phoneVerified?: boolean;
  readonly devVerifyUrl?: string;
  readonly devCode?: string;
};

export const now = (): Date => new Date();

export type ErrorCause =
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

const asDbError = (cause: unknown): DbError => {
  const candidate = cause as ErrorCause;
  if (cause instanceof Error) {
    return { _tag: "DbError", cause };
  }
  if (
    typeof candidate === "object"
    && candidate !== null
    && "message" in candidate
    && typeof (candidate as { readonly message?: string }).message === "string"
  ) {
    return {
      _tag: "DbError",
      cause: new Error((candidate as { readonly message: string }).message),
    };
  }
  let normalized: string;
  if (
    typeof candidate === "string"
    || typeof candidate === "number"
    || typeof candidate === "boolean"
    || typeof candidate === "bigint"
    || typeof candidate === "symbol"
  ) {
    normalized = String(candidate);
  } else {
    const serialized = JSON.stringify(candidate);
    normalized = typeof serialized === "string" ? serialized : "unknown_error";
  }
  return { _tag: "DbError", cause: new Error(normalized) };
};

const tryDb = <A>(op: () => PromiseLike<A>): Effect.Effect<A, DbError> =>
  Effect.tryPromise({
    try: op,
    catch: asDbError,
  });

export type VerificationDbError = DbError;
export const runDbEffect = tryDb;

export const respondVerificationError = (
  res: Response,
  status: number,
  code: VerificationErrorCode,
): null => {
  res.status(status).json({
    error: {
      code,
      message: verificationMessages[code],
    },
  });
  return null;
};

export const ensureAuthenticated = (
  req: Request,
  res: Response,
): string | null => {
  const { userId } = req.session;
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return userId;
};

export const findUserById = (
  id: string,
): Effect.Effect<typeof users.$inferSelect | undefined, DbError> =>
  tryDb(() =>
    db.query.users.findFirst({
      where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
    })
  );

export const countRecentRequests = (
  userId: string,
  type: VerificationType,
): Effect.Effect<number, DbError> =>
  pipe(
    tryDb(() =>
      db
        .select({ value: sql<number>`count(*)` })
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.userId, userId),
            eq(verificationCodes.type, type),
            gt(verificationCodes.createdAt, new Date(now().getTime() - 60 * 60 * 1000)),
          ),
        )
    ),
    Effect.map(([row]) => row?.value ?? 0),
  );

export const deactivateActiveCodes = (
  userId: string,
  type: VerificationType,
): Effect.Effect<void, DbError> =>
  pipe(
    tryDb(() =>
      db
        .update(verificationCodes)
        .set({ usedAt: now() })
        .where(
          and(
            eq(verificationCodes.userId, userId),
            eq(verificationCodes.type, type),
            isNull(verificationCodes.usedAt),
          ),
        )
    ),
    Effect.asVoid,
  );

export const insertVerificationCode = (
  params:
    & Omit<
      VerificationCodeRow,
      "id" | "createdAt" | "usedAt" | "attempts"
    >
    & { readonly attempts?: number },
): Effect.Effect<VerificationCodeRow | null, DbError> =>
  pipe(
    tryDb(() =>
      db
        .insert(verificationCodes)
        .values({
          ...params,
          attempts: params.attempts ?? 0,
        })
        .returning()
    ),
    Effect.map(([row]) => row ?? null),
  );

export const updateAttempts = (
  id: string,
  attempts: number,
): Effect.Effect<void, DbError> =>
  pipe(
    tryDb(() =>
      db
        .update(verificationCodes)
        .set({ attempts })
        .where(eq(verificationCodes.id, id))
    ),
    Effect.asVoid,
  );

const markVerifiedField = (
  code: VerificationCodeRow,
  timestamp: Date,
  field: "emailVerifiedAt" | "phoneVerifiedAt",
  metadata: { readonly ip?: string; readonly userAgent?: string },
): Effect.Effect<void, DbError> =>
  pipe(
    tryDb(() =>
      db.transaction((tx) =>
        tx
          .update(users)
          .set(
            field === "emailVerifiedAt"
              ? { emailVerifiedAt: timestamp, updatedAt: timestamp }
              : { phoneVerifiedAt: timestamp, updatedAt: timestamp },
          )
          .where(eq(users.id, code.userId))
          .then(() =>
            tx
              .update(verificationCodes)
              .set({
                usedAt: timestamp,
                confirmedIp: metadata.ip,
                confirmedUserAgent: metadata.userAgent,
              })
              .where(eq(verificationCodes.id, code.id))
          )
      )
    ),
    Effect.asVoid,
  );

export const markEmailVerified = (
  code: VerificationCodeRow,
  timestamp: Date,
  metadata: { readonly ip?: string; readonly userAgent?: string },
): Effect.Effect<void, DbError> => markVerifiedField(code, timestamp, "emailVerifiedAt", metadata);

export const markPhoneVerified = (
  code: VerificationCodeRow,
  timestamp: Date,
  metadata: { readonly ip?: string; readonly userAgent?: string },
): Effect.Effect<void, DbError> => markVerifiedField(code, timestamp, "phoneVerifiedAt", metadata);

export const evaluateOutcome = (
  code: VerificationCodeRow,
  providedHash: string,
): VerificationAttemptOutcome =>
  evaluateAttempt({
    storedHash: code.tokenHash,
    providedHash,
    attempts: code.attempts,
    maxAttempts: code.maxAttempts,
    expiresAt: code.expiresAt,
    usedAt: code.usedAt ?? null,
    now: now(),
  });

export const ensureRateLimit = (
  userId: string,
  type: VerificationType,
): Effect.Effect<"ok" | "rate_limited", DbError> =>
  pipe(
    countRecentRequests(userId, type),
    Effect.map((recent) => isRateLimited(recent, config.requestsPerHour) ? "rate_limited" : "ok"),
  );

export const ensureUserExists = (
  userEffect: Effect.Effect<typeof users.$inferSelect | undefined, DbError>,
  res: Response,
): Effect.Effect<typeof users.$inferSelect | null, DbError> =>
  pipe(
    userEffect,
    Effect.flatMap((user) =>
      user
        ? Effect.succeed(user)
        : Effect.sync(() => {
          res.status(404).json({ error: "user_not_found" });
          return null;
        })
    ),
  );

export type RequestContext = {
  readonly userId: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
};

export const extractRequestInfo = (
  req: Request,
): Omit<RequestContext, "userId"> =>
  ({
    ip: typeof req.ip === "string" ? req.ip : null,
    userAgent: typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : null,
  }) satisfies Omit<RequestContext, "userId">;

type InvalidOutcome = Extract<VerificationAttemptOutcome, { _tag: "Invalid" }>;

export const handleOutcome = (
  outcome: VerificationAttemptOutcome,
  res: Response,
  onInvalid: (invalid: InvalidOutcome) => Effect.Effect<void, DbError>,
  onVerified: () => Effect.Effect<void, DbError>,
): Effect.Effect<void, DbError> =>
  match(outcome)
    .with({ _tag: "Expired" }, () =>
      Effect.sync(() => {
        respondVerificationError(res, 400, "code_expired");
      }))
    .with({ _tag: "TooManyAttempts" }, () =>
      Effect.sync(() => {
        respondVerificationError(res, 400, "too_many_attempts");
      }))
    .with({ _tag: "Invalid" }, onInvalid)
    .with({ _tag: "Verified" }, onVerified)
    .exhaustive();

export const generateEmailToken = (): { readonly token: string; readonly tokenHash: string } => {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashVerificationToken(token) };
};
