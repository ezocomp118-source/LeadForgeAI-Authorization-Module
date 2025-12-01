import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { Response } from "express";

import type { users, VerificationCodeRow } from "../../core/schema/index.js";
import type { VerificationAttemptOutcome } from "../../core/verification.js";
import { db } from "../db.js";
import {
  ensureRateLimit,
  ensureUserExists,
  findUserById,
  respondVerificationError,
  runDbEffect,
  type VerificationDbError,
  type VerificationErrorCode,
  type VerificationType,
} from "./verification-shared.js";

type InvalidOutcome = Extract<VerificationAttemptOutcome, { _tag: "Invalid" }>;

export const respondVerificationSuccess = (
  res: Response,
  payload: { readonly alreadyVerified?: boolean; readonly emailVerified?: boolean; readonly phoneVerified?: boolean },
): Effect.Effect<void> =>
  Effect.sync(() => {
    res.status(200).json({
      status: "ok",
      ...payload,
    });
  });

export const respondInvalidVerification = (
  res: Response,
  code: VerificationErrorCode = "code_invalid",
): Effect.Effect<void> =>
  Effect.sync(() => {
    respondVerificationError(res, 400, code);
  });

export const enforceRateLimitOrRespond = (
  userId: string,
  type: VerificationType,
  res: Response,
): Effect.Effect<boolean, VerificationDbError> =>
  pipe(
    ensureRateLimit(userId, type),
    Effect.map((rate) => {
      if (rate === "rate_limited") {
        respondVerificationError(res, 429, "rate_limited");
        return false;
      }
      return true;
    }),
  );

export const loadUserForVerification = (
  userId: string,
  res: Response,
): Effect.Effect<typeof users.$inferSelect | null, VerificationDbError> =>
  pipe(
    ensureUserExists(findUserById(userId), res),
    Effect.map((user) => user ?? null),
  );

export const finalizeVerification = (
  effect: Effect.Effect<void, VerificationDbError>,
  res: Response,
  payload: { readonly emailVerified?: boolean; readonly phoneVerified?: boolean },
): Effect.Effect<void, VerificationDbError> =>
  pipe(
    effect,
    Effect.tap(() => respondVerificationSuccess(res, payload)),
  );

export const confirmVerificationRecord = (
  lookup: Effect.Effect<VerificationCodeRow | undefined, VerificationDbError>,
  res: Response,
  evaluate: (record: VerificationCodeRow) => VerificationAttemptOutcome,
  onInvalid: (record: VerificationCodeRow, outcome: InvalidOutcome) => Effect.Effect<void, VerificationDbError>,
  onVerified: (record: VerificationCodeRow) => Effect.Effect<void, VerificationDbError>,
): Effect.Effect<void, VerificationDbError> =>
  pipe(
    lookup,
    Effect.flatMap((record) =>
      record
        ? matchOutcome(evaluate(record), res, (outcome) => onInvalid(record, outcome), () => onVerified(record))
        : respondInvalidVerification(res)
    ),
  );

const matchOutcome = (
  outcome: VerificationAttemptOutcome,
  res: Response,
  onInvalid: (invalid: InvalidOutcome) => Effect.Effect<void, VerificationDbError>,
  onVerified: () => Effect.Effect<void, VerificationDbError>,
): Effect.Effect<void, VerificationDbError> =>
  pipe(
    outcome,
    (current) =>
      current._tag === "Expired"
        ? Effect.sync(() => {
          respondVerificationError(res, 400, "code_expired");
        })
        : current._tag === "TooManyAttempts"
        ? Effect.sync(() => {
          respondVerificationError(res, 400, "too_many_attempts");
        })
        : current._tag === "Invalid"
        ? onInvalid(current)
        : onVerified(),
  );

type VerificationFindArgs = NonNullable<Parameters<(typeof db.query.verificationCodes)["findFirst"]>[0]>;
type VerificationWhere = VerificationFindArgs["where"];
type VerificationOrderBy = VerificationFindArgs["orderBy"];

const findVerificationCode = (
  params: {
    readonly where: VerificationWhere;
    readonly orderBy?: VerificationOrderBy;
  },
): Effect.Effect<VerificationCodeRow | undefined, VerificationDbError> =>
  runDbEffect(() =>
    db.query.verificationCodes.findFirst({
      where: params.where,
      ...(params.orderBy ? { orderBy: params.orderBy } : {}),
    })
  );

export const finalizeWithMetadata = (
  mark: (metadata: { readonly ip?: string; readonly userAgent?: string }) => Effect.Effect<void, VerificationDbError>,
  metadata: { readonly ip: string | null; readonly userAgent: string | null },
  res: Response,
  payload: { readonly emailVerified?: boolean; readonly phoneVerified?: boolean },
): Effect.Effect<void, VerificationDbError> =>
  finalizeVerification(
    mark({
      ...(metadata.ip ? { ip: metadata.ip } : {}),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
    }),
    res,
    payload,
  );

export const lookupEmailVerification = (
  tokenHash: string,
): Effect.Effect<VerificationCodeRow | undefined, VerificationDbError> =>
  findVerificationCode({
    where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(tbl.tokenHash, tokenHash),
        eqFn(tbl.type, "email"),
        isNullFn(tbl.usedAt),
      ),
  });

export const lookupLatestPhoneVerification = (
  userId: string,
): Effect.Effect<VerificationCodeRow | undefined, VerificationDbError> =>
  findVerificationCode({
    where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
      andFn(
        eqFn(tbl.userId, userId),
        eqFn(tbl.type, "phone"),
        isNullFn(tbl.usedAt),
      ),
    orderBy: (tbl, { desc: descFn }) => [descFn(tbl.createdAt)],
  });

export const finalizeVerificationMark = (
  mark: (metadata: { readonly ip?: string; readonly userAgent?: string }) => Effect.Effect<void, VerificationDbError>,
  metadata: { readonly ip: string | null; readonly userAgent: string | null },
  res: Response,
  key: "emailVerified" | "phoneVerified",
): Effect.Effect<void, VerificationDbError> =>
  finalizeWithMetadata(
    mark,
    metadata,
    res,
    key === "emailVerified" ? { emailVerified: true } : { phoneVerified: true },
  );
