import * as Effect from "effect/Effect";
import type { Response } from "express";
import type { users, VerificationCodeRow } from "../../core/schema/index.js";
import type { VerificationAttemptOutcome } from "../../core/verification.js";
import { type VerificationDbError, type VerificationErrorCode, type VerificationType } from "./verification-shared.js";
type InvalidOutcome = Extract<VerificationAttemptOutcome, {
    _tag: "Invalid";
}>;
export declare const respondVerificationSuccess: (res: Response, payload: {
    readonly alreadyVerified?: boolean;
    readonly emailVerified?: boolean;
    readonly phoneVerified?: boolean;
}) => Effect.Effect<void>;
export declare const respondInvalidVerification: (res: Response, code?: VerificationErrorCode) => Effect.Effect<void>;
export declare const enforceRateLimitOrRespond: (userId: string, type: VerificationType, res: Response) => Effect.Effect<boolean, VerificationDbError>;
export declare const loadUserForVerification: (userId: string, res: Response) => Effect.Effect<typeof users.$inferSelect | null, VerificationDbError>;
export declare const finalizeVerification: (effect: Effect.Effect<void, VerificationDbError>, res: Response, payload: {
    readonly emailVerified?: boolean;
    readonly phoneVerified?: boolean;
}) => Effect.Effect<void, VerificationDbError>;
export declare const confirmVerificationRecord: (lookup: Effect.Effect<VerificationCodeRow | undefined, VerificationDbError>, res: Response, evaluate: (record: VerificationCodeRow) => VerificationAttemptOutcome, onInvalid: (record: VerificationCodeRow, outcome: InvalidOutcome) => Effect.Effect<void, VerificationDbError>, onVerified: (record: VerificationCodeRow) => Effect.Effect<void, VerificationDbError>) => Effect.Effect<void, VerificationDbError>;
export declare const finalizeWithMetadata: (mark: (metadata: {
    readonly ip?: string;
    readonly userAgent?: string;
}) => Effect.Effect<void, VerificationDbError>, metadata: {
    readonly ip: string | null;
    readonly userAgent: string | null;
}, res: Response, payload: {
    readonly emailVerified?: boolean;
    readonly phoneVerified?: boolean;
}) => Effect.Effect<void, VerificationDbError>;
export declare const lookupEmailVerification: (tokenHash: string) => Effect.Effect<VerificationCodeRow | undefined, VerificationDbError>;
export declare const lookupLatestPhoneVerification: (userId: string) => Effect.Effect<VerificationCodeRow | undefined, VerificationDbError>;
export declare const finalizeVerificationMark: (mark: (metadata: {
    readonly ip?: string;
    readonly userAgent?: string;
}) => Effect.Effect<void, VerificationDbError>, metadata: {
    readonly ip: string | null;
    readonly userAgent: string | null;
}, res: Response, key: "emailVerified" | "phoneVerified") => Effect.Effect<void, VerificationDbError>;
export {};
