import type { VerificationCodeRow } from "./schema/verification.js";
export type VerificationType = VerificationCodeRow["type"];
export type VerificationErrorCode = "code_invalid" | "code_expired" | "too_many_attempts";
export type VerificationAttemptOutcome = {
    readonly _tag: "Expired";
    readonly code: "code_expired";
} | {
    readonly _tag: "TooManyAttempts";
    readonly code: "too_many_attempts";
    readonly attempts: number;
    readonly maxAttempts: number;
} | {
    readonly _tag: "Invalid";
    readonly code: "code_invalid";
    readonly nextAttempts: number;
    readonly maxAttempts: number;
} | {
    readonly _tag: "Verified";
    readonly code: null;
};
type AttemptInput = {
    readonly storedHash: string;
    readonly providedHash: string;
    readonly attempts: number;
    readonly maxAttempts: number;
    readonly expiresAt: Date;
    readonly usedAt: Date | null;
    readonly now: Date;
};
export declare const hashVerificationToken: (token: string) => string;
export declare const computeExpiresAt: (nowMs: number, ttlMinutes: number) => Date;
export declare const evaluateAttempt: ({ storedHash, providedHash, attempts, maxAttempts, expiresAt, usedAt, now, }: AttemptInput) => VerificationAttemptOutcome;
export declare const isRateLimited: (issuedInWindow: number, limit: number) => boolean;
export {};
