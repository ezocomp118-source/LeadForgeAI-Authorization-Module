import type { RequestHandler } from "express";
import fetch from "node-fetch";
import { computeExpiresAt, hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import {
  config,
  deactivateActiveCodes,
  ensureRateLimit,
  evaluateOutcome,
  extractRequestInfo,
  generateEmailToken,
  handleOutcome,
  insertVerificationCode,
  markEmailVerified,
  now,
  respondVerificationError,
  type VerificationRequestResponse,
  withAuthenticatedUser,
} from "./verification-shared.js";

const sendEmailVerification = (to: string, verifyUrl: string) =>
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
    return undefined;
  });

const respondAlreadyVerifiedEmail = (res: Parameters<RequestHandler>[1]) => {
  res.status(200).json({
    status: "ok",
    alreadyVerified: true,
    emailVerified: true,
  });
  return null;
};

export const requestEmailVerification: RequestHandler = (req, res, next) => {
  withAuthenticatedUser(req, res, next, (user, ctx) => {
    if (user.emailVerifiedAt) {
      respondAlreadyVerifiedEmail(res);
      return;
    }
    void ensureRateLimit(user.id, "email", res).then((allowed) => {
      if (allowed === null) {
        return null;
      }
      const { token, tokenHash } = generateEmailToken();
      const expiresAt = computeExpiresAt(
        now().getTime(),
        config.emailTtlMinutes,
      );
      const verifyUrl = `${config.appUrl}/auth/email/verify?token=${encodeURIComponent(token)}`;
      return deactivateActiveCodes(user.id, "email")
        .then(() =>
          insertVerificationCode({
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
          })
        )
        .then(() => sendEmailVerification(user.email, verifyUrl))
        .then(() => {
          const payload: VerificationRequestResponse = config.devMode
            ? { status: "ok", devVerifyUrl: verifyUrl }
            : { status: "ok" };
          res.status(200).json(payload);
          return null;
        });
    });
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
  db.query.verificationCodes
    .findFirst({
      where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
        andFn(
          eqFn(tbl.tokenHash, tokenHash),
          eqFn(tbl.type, "email"),
          isNullFn(tbl.usedAt),
        ),
    })
    .then((record) => {
      if (!record) {
        return respondVerificationError(res, 400, "code_invalid");
      }
      const outcome = evaluateOutcome(record, tokenHash);
      return handleOutcome(
        outcome,
        res,
        () => respondVerificationError(res, 400, "code_invalid"),
        () => {
          void markEmailVerified(record, now(), {
            ...(ip ? { ip } : {}),
            ...(userAgent ? { userAgent } : {}),
          }).then(() => res.status(200).json({ status: "ok", emailVerified: true }));
        },
      );
    })
    .catch(next);
};
