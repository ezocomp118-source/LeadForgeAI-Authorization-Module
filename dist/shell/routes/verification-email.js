import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import fetch from "node-fetch";
import { computeExpiresAt, hashVerificationToken } from "../../core/verification.js";
import { confirmVerificationRecord, enforceRateLimitOrRespond, finalizeVerificationMark, loadUserForVerification, lookupEmailVerification, respondVerificationSuccess, } from "./verification-flow.js";
import { config, deactivateActiveCodes, ensureAuthenticated, evaluateOutcome, extractRequestInfo, generateEmailToken, insertVerificationCode, markEmailVerified, now, respondVerificationError, updateAttempts, } from "./verification-shared.js";
const sendEmailVerification = (to, verifyUrl) => Effect.tryPromise({
    try: () => fetch("https://api.resend.com/emails", {
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
const respondInvalidEmailCode = (res) => Effect.sync(() => {
    respondVerificationError(res, 400, "code_invalid");
});
const incrementEmailAttempts = (recordId, attempts, res) => pipe(updateAttempts(recordId, attempts), Effect.tap(() => respondInvalidEmailCode(res)));
const confirmEmail = (record, res, metadata) => finalizeVerificationMark((meta) => markEmailVerified(record, now(), meta), metadata, res, "emailVerified");
const buildRequestEmailProgram = (userId, res, ctx) => Effect.gen(function* (_) {
    const user = yield* _(loadUserForVerification(userId, res));
    if (!user) {
        return;
    }
    if (user.emailVerifiedAt) {
        yield* _(respondVerificationSuccess(res, { alreadyVerified: true, emailVerified: true }));
        return;
    }
    const allowed = yield* _(enforceRateLimitOrRespond(user.id, "email", res));
    if (!allowed) {
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
    const payload = config.devMode
        ? { status: "ok", devVerifyUrl: verifyUrl }
        : { status: "ok" };
    res.status(200).json(payload);
});
export const requestEmailVerification = (req, res, next) => {
    const userId = ensureAuthenticated(req, res);
    if (!userId) {
        return;
    }
    const ctx = extractRequestInfo(req);
    const program = buildRequestEmailProgram(userId, res, ctx);
    Effect.runPromise(program).catch((error) => {
        const candidate = error;
        if (candidate.cause instanceof Error) {
            next(candidate.cause);
            return;
        }
        next(error);
    });
};
const buildConfirmEmailProgram = (tokenHash, res, metadata) => confirmVerificationRecord(lookupEmailVerification(tokenHash), res, (record) => evaluateOutcome(record, tokenHash), (record, outcome) => {
    void outcome;
    return incrementEmailAttempts(record.id, record.attempts + 1, res);
}, (record) => confirmEmail(record, res, metadata));
export const confirmEmailVerification = (req, res, next) => {
    const { token } = req.body;
    if (typeof token !== "string" || token.trim().length === 0) {
        res.status(400).json({ error: "invalid_payload" });
        return;
    }
    const { ip, userAgent } = extractRequestInfo(req);
    const tokenHash = hashVerificationToken(token);
    const program = buildConfirmEmailProgram(tokenHash, res, { ip, userAgent });
    Effect.runPromise(program).catch(next);
};
