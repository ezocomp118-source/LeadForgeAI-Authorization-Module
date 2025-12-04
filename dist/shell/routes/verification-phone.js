import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { randomBytes } from "node:crypto";
import { computeExpiresAt, hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import { confirmVerificationRecord, enforceRateLimitOrRespond, finalizeVerificationMark, loadUserForVerification, lookupLatestPhoneVerification, respondVerificationSuccess, } from "./verification-flow.js";
import { config, deactivateActiveCodes, ensureAuthenticated, ensureUserExists, evaluateOutcome, extractRequestInfo, insertVerificationCode, markPhoneVerified, now, respondVerificationError, runDbEffect, updateAttempts, verificationRequiredMessage, } from "./verification-shared.js";
const generatePhoneCode = () => {
    const randomValue = randomBytes(4).readUInt32BE(0);
    const sixDigit = (randomValue % 900_000) + 100_000;
    const code = sixDigit.toString().padStart(6, "0");
    return { code, codeHash: hashVerificationToken(code) };
};
const buildPhoneInsertPayload = (user, codeHash, expiresAt, ctx) => ({
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
});
const respondPhonePayload = (res, code) => {
    const payload = config.devMode ? { status: "ok", devCode: code } : { status: "ok" };
    res.status(200).json(payload);
};
const respondInvalidPhoneCode = (res, error = "code_invalid") => Effect.sync(() => {
    respondVerificationError(res, 400, error);
});
const incrementPhoneAttempts = (recordId, attempts, res, limitReached) => pipe(updateAttempts(recordId, attempts), Effect.tap(() => respondInvalidPhoneCode(res, limitReached ? "too_many_attempts" : "code_invalid")));
const confirmPhone = (record, res, metadata) => finalizeVerificationMark((meta) => markPhoneVerified(record, now(), meta), metadata, res, "phoneVerified");
const buildRequestPhoneProgram = (userId, res, ctx) => Effect.gen(function* (_) {
    const user = yield* _(loadUserForVerification(userId, res));
    if (!user) {
        return;
    }
    if (user.phoneVerifiedAt) {
        yield* _(respondVerificationSuccess(res, { alreadyVerified: true, phoneVerified: true }));
        return;
    }
    const allowed = yield* _(enforceRateLimitOrRespond(user.id, "phone", res));
    if (!allowed) {
        return;
    }
    const { code, codeHash } = generatePhoneCode();
    const expiresAt = computeExpiresAt(now().getTime(), config.phoneTtlMinutes);
    yield* _(deactivateActiveCodes(user.id, "phone"));
    yield* _(insertVerificationCode(buildPhoneInsertPayload(user, codeHash, expiresAt, ctx)));
    respondPhonePayload(res, code);
});
export const requestPhoneVerification = (req, res, next) => {
    const userId = ensureAuthenticated(req, res);
    if (!userId) {
        return;
    }
    const ctx = extractRequestInfo(req);
    const program = buildRequestPhoneProgram(userId, res, ctx);
    Effect.runPromise(program).catch(next);
};
const buildConfirmPhoneProgram = (userId, codeHash, res, metadata) => confirmVerificationRecord(lookupLatestPhoneVerification(userId), res, (record) => evaluateOutcome(record, codeHash), (record, outcome) => {
    void outcome;
    return pipe(incrementPhoneAttempts(record.id, record.attempts + 1, res, record.attempts + 1 >= record.maxAttempts));
}, (record) => confirmPhone(record, res, {
    ip: metadata.ip,
    userAgent: metadata.userAgent,
}));
export const confirmPhoneVerification = (req, res, next) => {
    const userId = ensureAuthenticated(req, res);
    if (!userId) {
        return;
    }
    const { code } = req.body;
    if (typeof code !== "string" || code.trim().length === 0) {
        res.status(400).json({ error: "invalid_payload" });
        return;
    }
    const { ip, userAgent } = extractRequestInfo(req);
    const codeHash = hashVerificationToken(code);
    const program = buildConfirmPhoneProgram(userId, codeHash, res, { ip, userAgent });
    Effect.runPromise(program).catch(next);
};
export const requireVerificationGuard = (requirements = {
    requireEmailVerified: config.requireEmailVerified,
    requirePhoneVerified: config.requirePhoneVerified,
}) => (req, res, next) => {
    const userId = ensureAuthenticated(req, res);
    if (!userId) {
        return;
    }
    const program = pipe(ensureUserExists(runDbEffect(() => db.query.users.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.id, userId),
    })), res), Effect.tap((user) => user
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
        : Effect.succeed(undefined)));
    Effect.runPromise(program).catch(next);
};
