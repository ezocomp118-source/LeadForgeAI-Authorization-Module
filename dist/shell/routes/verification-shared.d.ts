import * as Effect from "effect/Effect";
import type { Request, Response } from "express";
import { users, type VerificationCodeRow } from "../../core/schema/index.js";
import { type VerificationAttemptOutcome } from "../../core/verification.js";
import { type DbError } from "./db-error.js";
import { config, verificationMessages, verificationRequiredMessage } from "./verification-config.js";
export { config, verificationMessages, verificationRequiredMessage };
export type VerificationErrorCode = "code_invalid" | "code_expired" | "too_many_attempts" | "rate_limited";
export type VerificationType = VerificationCodeRow["type"];
export type VerificationRequestResponse = {
    readonly status: "ok";
    readonly alreadyVerified?: boolean;
    readonly emailVerified?: boolean;
    readonly phoneVerified?: boolean;
    readonly devVerifyUrl?: string;
    readonly devCode?: string;
};
export declare const now: () => Date;
export type VerificationDbError = DbError;
export declare const runDbEffect: <A>(op: () => PromiseLike<A>) => Effect.Effect<A, DbError>;
export declare const respondVerificationError: (res: Response, status: number, code: VerificationErrorCode) => null;
export declare const ensureAuthenticated: (req: Request, res: Response) => string | null;
export declare const findUserById: (id: string) => Effect.Effect<typeof users.$inferSelect | undefined, DbError>;
export declare const countRecentRequests: (userId: string, type: VerificationType) => Effect.Effect<number, DbError>;
export declare const deactivateActiveCodes: (userId: string, type: VerificationType) => Effect.Effect<void, DbError>;
export declare const insertVerificationCode: (params: Omit<VerificationCodeRow, "id" | "createdAt" | "usedAt" | "attempts"> & {
    readonly attempts?: number;
}) => Effect.Effect<VerificationCodeRow | null, DbError>;
export declare const updateAttempts: (id: string, attempts: number) => Effect.Effect<void, DbError>;
export declare const markEmailVerified: (code: VerificationCodeRow, timestamp: Date, metadata: {
    readonly ip?: string;
    readonly userAgent?: string;
}) => Effect.Effect<void, DbError>;
export declare const markPhoneVerified: (code: VerificationCodeRow, timestamp: Date, metadata: {
    readonly ip?: string;
    readonly userAgent?: string;
}) => Effect.Effect<void, DbError>;
export declare const evaluateOutcome: (code: VerificationCodeRow, providedHash: string) => VerificationAttemptOutcome;
export declare const ensureRateLimit: (userId: string, type: VerificationType) => Effect.Effect<"ok" | "rate_limited", DbError>;
export declare const ensureUserExists: (userEffect: Effect.Effect<typeof users.$inferSelect | undefined, DbError>, res: Response) => Effect.Effect<typeof users.$inferSelect | null, DbError>;
export type RequestContext = {
    readonly userId: string;
    readonly ip: string | null;
    readonly userAgent: string | null;
};
export declare const extractRequestInfo: (req: Request) => Omit<RequestContext, "userId">;
export declare const generateEmailToken: () => {
    readonly token: string;
    readonly tokenHash: string;
};
