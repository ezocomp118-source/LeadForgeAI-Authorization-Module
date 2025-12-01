import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { RequestHandler } from "express";
import fetch from "node-fetch";

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
  generateEmailToken,
  handleOutcome,
  insertVerificationCode,
  markEmailVerified,
  now,
  respondVerificationError,
  runDbEffect,
  updateAttempts,
  type VerificationRequestResponse,
} from "./verification-shared.js";

type EmailSendError = { readonly _tag: "EmailSendFailed"; readonly cause: Error };

const sendEmailVerification = (
  to: string,
  verifyUrl: string,
): Effect.Effect<void, EmailSendError> =>
  Effect.tryPromise({
    try: () =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: config.emailOverride ?? to,
          subject: "Email verification",
          html: `<p>Подтвердите email: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
          text: `Подтвердите email: ${verifyUrl}`,
        }),
      }).then((response) => {
        if (!response.ok) {
          throw new Error("email_send_failed");
        }
      }),
    catch: (cause) => ({
      _tag: "EmailSendFailed",
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    }),
  });

const respondAlreadyVerifiedEmail = (
  res: Parameters<RequestHandler>[1],
): null => {
  res.status(200).json({
    status: "ok",
    alreadyVerified: true,
    emailVerified: true,
  });
  return null;
};

export const requestEmailVerification: RequestHandler = (req, res, next) => {
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
    if (user.emailVerifiedAt) {
      respondAlreadyVerifiedEmail(res);
      return;
    }
    const rate = yield* _(ensureRateLimit(user.id, "email"));
    if (rate === "rate_limited") {
      respondVerificationError(res, 429, "rate_limited");
      return;
    }
    const { token, tokenHash } = generateEmailToken();
    const expiresAt = computeExpiresAt(now().getTime(), config.emailTtlMinutes);
    const verifyUrl = `${config.appUrl}/auth/email/verify?token=${encodeURIComponent(token)}`;
    yield* _(deactivateActiveCodes(user.id, "email"));
    yield* _(insertVerificationCode({
      userId: user.id,
      type: "email",
      sentTo: user.email,
      tokenHash,
      expiresAt,
      maxAttempts: 1,
      requestedIp: ctx.ip,
      requestedUserAgent: ctx.userAgent,
      confirmedIp: null,
      confirmedUserAgent: null,
    }));
    yield* _(sendEmailVerification(user.email, verifyUrl));
    const payload: VerificationRequestResponse = config.devMode
      ? { status: "ok", devVerifyUrl: verifyUrl }
      : { status: "ok" };
    res.status(200).json(payload);
  });
  Effect.runPromise(program).catch((error) => {
    const candidate = error as { readonly cause?: Error };
    if (candidate.cause instanceof Error) {
      next(candidate.cause);
      return;
    }
    next(error as Error);
  });
};

export const confirmEmailVerification: RequestHandler = (req, res, next) => {
  const { token } = req.body as { readonly token?: string };
  if (typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const { ip, userAgent } = extractRequestInfo(req);
  const tokenHash = hashVerificationToken(token);
  const program = pipe(
    runDbEffect(() =>
      db.query.verificationCodes.findFirst({
        where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
          andFn(
            eqFn(tbl.tokenHash, tokenHash),
            eqFn(tbl.type, "email"),
            isNullFn(tbl.usedAt),
          ),
      })
    ),
    Effect.flatMap((record) =>
      record
        ? handleOutcome(
          evaluateOutcome(record, tokenHash),
          res,
          () =>
            pipe(
              updateAttempts(record.id, record.attempts + 1),
              Effect.tap(() =>
                Effect.sync(() => {
                  respondVerificationError(res, 400, "code_invalid");
                })
              ),
            ),
          () =>
            pipe(
              markEmailVerified(
                record,
                now(),
                {
                  ...(ip ? { ip } : {}),
                  ...(userAgent ? { userAgent } : {}),
                },
              ),
              Effect.tap(() =>
                Effect.sync(() => {
                  res.status(200).json({ status: "ok", emailVerified: true });
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
