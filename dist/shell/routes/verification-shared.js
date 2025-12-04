import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { users, verificationCodes } from "../../core/schema/index.js";
import { evaluateAttempt, hashVerificationToken, isRateLimited, } from "../../core/verification.js";
import { db } from "../db.js";
import { asDbError } from "./db-error.js";
import { config, verificationMessages, verificationRequiredMessage } from "./verification-config.js";
export { config, verificationMessages, verificationRequiredMessage };
export const now = () => new Date();
const tryDb = (op) => Effect.tryPromise({
    try: op,
    catch: (cause) => asDbError(cause),
});
export const runDbEffect = tryDb;
export const respondVerificationError = (res, status, code) => {
    res.status(status).json({
        error: {
            code,
            message: verificationMessages[code],
        },
    });
    return null;
};
export const ensureAuthenticated = (req, res) => {
    const { userId } = req.session;
    if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return null;
    }
    return userId;
};
export const findUserById = (id) => tryDb(() => db.query.users.findFirst({
    where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
}));
export const countRecentRequests = (userId, type) => pipe(tryDb(() => db
    .select({ value: sql `count(*)` })
    .from(verificationCodes)
    .where(and(eq(verificationCodes.userId, userId), eq(verificationCodes.type, type), gt(verificationCodes.createdAt, new Date(now().getTime() - 60 * 60 * 1000))))), Effect.map(([row]) => row?.value ?? 0));
export const deactivateActiveCodes = (userId, type) => pipe(tryDb(() => db
    .update(verificationCodes)
    .set({ usedAt: now() })
    .where(and(eq(verificationCodes.userId, userId), eq(verificationCodes.type, type), isNull(verificationCodes.usedAt)))), Effect.asVoid);
export const insertVerificationCode = (params) => pipe(tryDb(() => db
    .insert(verificationCodes)
    .values({
    ...params,
    attempts: params.attempts ?? 0,
})
    .returning()), Effect.map(([row]) => row ?? null));
export const updateAttempts = (id, attempts) => pipe(tryDb(() => db
    .update(verificationCodes)
    .set({ attempts })
    .where(eq(verificationCodes.id, id))), Effect.asVoid);
const markVerifiedField = (code, timestamp, field, metadata) => pipe(tryDb(() => db.transaction((tx) => tx
    .update(users)
    .set(field === "emailVerifiedAt"
    ? { emailVerifiedAt: timestamp, updatedAt: timestamp }
    : { phoneVerifiedAt: timestamp, updatedAt: timestamp })
    .where(eq(users.id, code.userId))
    .then(() => tx
    .update(verificationCodes)
    .set({
    usedAt: timestamp,
    confirmedIp: metadata.ip,
    confirmedUserAgent: metadata.userAgent,
})
    .where(eq(verificationCodes.id, code.id))))), Effect.asVoid);
export const markEmailVerified = (code, timestamp, metadata) => markVerifiedField(code, timestamp, "emailVerifiedAt", metadata);
export const markPhoneVerified = (code, timestamp, metadata) => markVerifiedField(code, timestamp, "phoneVerifiedAt", metadata);
export const evaluateOutcome = (code, providedHash) => evaluateAttempt({
    storedHash: code.tokenHash,
    providedHash,
    attempts: code.attempts,
    maxAttempts: code.maxAttempts,
    expiresAt: code.expiresAt,
    usedAt: code.usedAt ?? null,
    now: now(),
});
export const ensureRateLimit = (userId, type) => pipe(countRecentRequests(userId, type), Effect.map((recent) => isRateLimited(recent, config.requestsPerHour) ? "rate_limited" : "ok"));
export const ensureUserExists = (userEffect, res) => pipe(userEffect, Effect.flatMap((user) => user
    ? Effect.succeed(user)
    : Effect.sync(() => {
        res.status(404).json({ error: "user_not_found" });
        return null;
    })));
export const extractRequestInfo = (req) => ({
    ip: typeof req.ip === "string" ? req.ip : null,
    userAgent: typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : null,
});
export const generateEmailToken = () => {
    const token = randomBytes(32).toString("hex");
    return { token, tokenHash: hashVerificationToken(token) };
};
