import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { db } from "../db.js";
import { ensureRateLimit, ensureUserExists, findUserById, respondVerificationError, runDbEffect, } from "./verification-shared.js";
export const respondVerificationSuccess = (res, payload) => Effect.sync(() => {
    res.status(200).json({
        status: "ok",
        ...payload,
    });
});
export const respondInvalidVerification = (res, code = "code_invalid") => Effect.sync(() => {
    respondVerificationError(res, 400, code);
});
export const enforceRateLimitOrRespond = (userId, type, res) => pipe(ensureRateLimit(userId, type), Effect.map((rate) => {
    if (rate === "rate_limited") {
        respondVerificationError(res, 429, "rate_limited");
        return false;
    }
    return true;
}));
export const loadUserForVerification = (userId, res) => pipe(ensureUserExists(findUserById(userId), res), Effect.map((user) => user ?? null));
export const finalizeVerification = (effect, res, payload) => pipe(effect, Effect.tap(() => respondVerificationSuccess(res, payload)));
export const confirmVerificationRecord = (lookup, res, evaluate, onInvalid, onVerified) => pipe(lookup, Effect.flatMap((record) => record
    ? matchOutcome(evaluate(record), res, (outcome) => onInvalid(record, outcome), () => onVerified(record))
    : respondInvalidVerification(res)));
const matchOutcome = (outcome, res, onInvalid, onVerified) => pipe(outcome, (current) => current._tag === "Expired"
    ? Effect.sync(() => {
        respondVerificationError(res, 400, "code_expired");
    })
    : current._tag === "TooManyAttempts"
        ? Effect.sync(() => {
            respondVerificationError(res, 400, "too_many_attempts");
        })
        : current._tag === "Invalid"
            ? onInvalid(current)
            : onVerified());
const findVerificationCode = (params) => runDbEffect(() => db.query.verificationCodes.findFirst({
    where: params.where,
    ...(params.orderBy ? { orderBy: params.orderBy } : {}),
}));
export const finalizeWithMetadata = (mark, metadata, res, payload) => finalizeVerification(mark({
    ...(metadata.ip ? { ip: metadata.ip } : {}),
    ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
}), res, payload);
export const lookupEmailVerification = (tokenHash) => findVerificationCode({
    where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) => andFn(eqFn(tbl.tokenHash, tokenHash), eqFn(tbl.type, "email"), isNullFn(tbl.usedAt)),
});
export const lookupLatestPhoneVerification = (userId) => findVerificationCode({
    where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) => andFn(eqFn(tbl.userId, userId), eqFn(tbl.type, "phone"), isNullFn(tbl.usedAt)),
    orderBy: (tbl, { desc: descFn }) => [descFn(tbl.createdAt)],
});
export const finalizeVerificationMark = (mark, metadata, res, key) => finalizeWithMetadata(mark, metadata, res, key === "emailVerified" ? { emailVerified: true } : { phoneVerified: true });
