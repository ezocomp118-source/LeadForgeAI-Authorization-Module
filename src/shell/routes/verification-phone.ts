import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { RequestHandler } from "express";
import { randomBytes } from "node:crypto";

import { computeExpiresAt, hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import {
  config,
  deactivateActiveCodes,
  ensureAuthenticated,
  ensureRateLimit,
  ensureUserExists,
  evaluateOutcome,
  extractRequestInfo,
  handleOutcome,
  insertVerificationCode,
  markPhoneVerified,
  now,
  respondVerificationError,
  runDbEffect,
  updateAttempts,
  verificationRequiredMessage,
} from "./verification-shared.js";

const generatePhoneCode = (): { readonly code: string; readonly codeHash: string } => {
  const randomValue = randomBytes(4).readUInt32BE(0);
  const sixDigit = (randomValue % 900_000) + 100_000;
  const code = sixDigit.toString().padStart(6, "0");
  return { code, codeHash: hashVerificationToken(code) };
};

export const requestPhoneVerification: RequestHandler = (req, res, next) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) {
    return;
  }
  const ctx = extractRequestInfo(req);
  const program = Effect.gen(function*(_) {
    const user = yield* _(ensureUserExists(
      runDbEffect(() =>
        db.query.users.findFirst({
          where: (tbl, { eq: eqFn }) => eqFn(tbl.id, userId),
        })
      ),
      res,
    ));
    if (!user) {
      return;
    }
    if (user.phoneVerifiedAt) {
      res.status(200).json({
        status: "ok",
        alreadyVerified: true,
        phoneVerified: true,
      });
      return;
    }
    const rate = yield* _(ensureRateLimit(user.id, "phone"));
    if (rate === "rate_limited") {
      respondVerificationError(res, 429, "rate_limited");
      return;
    }
    const { code, codeHash } = generatePhoneCode();
    const expiresAt = computeExpiresAt(
      now().getTime(),
      config.phoneTtlMinutes,
    );
    yield* _(deactivateActiveCodes(user.id, "phone"));
    yield* _(insertVerificationCode({
      userId: user.id,
      type: "phone",
      sentTo: user.phone,
      tokenHash: codeHash,
      expiresAt,
      maxAttempts: config.phoneMaxAttempts,
      requestedIp: ctx.ip,
      requestedUserAgent: ctx.userAgent,
      confirmedIp: null,
      confirmedUserAgent: null,
    }));
    const payload = config.devMode
      ? { status: "ok", devCode: code }
      : { status: "ok" };
    res.status(200).json(payload);
  });
  Effect.runPromise(program).catch(next);
};

export const confirmPhoneVerification: RequestHandler = (req, res, next) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) {
    return;
  }
  const { code } = req.body as { readonly code?: string };
  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const { ip, userAgent } = extractRequestInfo(req);
  const codeHash = hashVerificationToken(code);
  const program = pipe(
    runDbEffect(() =>
      db.query.verificationCodes.findFirst({
        where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
          andFn(
            eqFn(tbl.userId, userId),
            eqFn(tbl.type, "phone"),
            isNullFn(tbl.usedAt),
          ),
        orderBy: (tbl, { desc: descFn }) => [descFn(tbl.createdAt)],
      })
    ),
    Effect.flatMap((record) =>
      record
        ? handleOutcome(
          evaluateOutcome(record, codeHash),
          res,
          () =>
            pipe(
              updateAttempts(record.id, record.attempts + 1),
              Effect.tap(() =>
                Effect.sync(() => {
                  const limitReached = record.attempts + 1 >= record.maxAttempts;
                  respondVerificationError(
                    res,
                    400,
                    limitReached ? "too_many_attempts" : "code_invalid",
                  );
                })
              ),
            ),
          () =>
            pipe(
              markPhoneVerified(
                record,
                now(),
                {
                  ...(ip ? { ip } : {}),
                  ...(userAgent ? { userAgent } : {}),
                },
              ),
              Effect.tap(() =>
                Effect.sync(() => {
                  res.status(200).json({ status: "ok", phoneVerified: true });
                })
              ),
            ),
        )
        : Effect.sync(() => {
          respondVerificationError(res, 400, "code_invalid");
        })
    ),
  );
  Effect.runPromise(program).catch(next);
};

export const requireVerificationGuard = (
  requirements: {
    readonly requireEmailVerified?: boolean;
    readonly requirePhoneVerified?: boolean;
  } = {
    requireEmailVerified: config.requireEmailVerified,
    requirePhoneVerified: config.requirePhoneVerified,
  },
): RequestHandler =>
(req, res, next) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) {
    return;
  }
  const program = pipe(
    ensureUserExists(
      runDbEffect(() =>
        db.query.users.findFirst({
          where: (tbl, { eq: eqFn }) => eqFn(tbl.id, userId),
        })
      ),
      res,
    ),
    Effect.tap((user) =>
      user
        ? Effect.sync(() => {
          const emailOk = requirements.requireEmailVerified === true
            ? user.emailVerifiedAt !== null
            : true;
          const phoneOk = requirements.requirePhoneVerified === true
            ? user.phoneVerifiedAt !== null
            : true;
          if (emailOk && phoneOk) {
            next();
            return;
          }
          res.status(403).json({
            error: requirements.requirePhoneVerified
              ? "verification_required_phone"
              : "verification_required_email",
            message: verificationRequiredMessage,
          });
        })
        : Effect.succeed(undefined)
    ),
  );
  Effect.runPromise(program).catch(next);
};
