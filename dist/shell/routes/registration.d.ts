import type { RequestHandler } from "express";
import { type PasswordPolicyResult, type RegisterCandidate } from "./auth-helpers.js";
type RegisterRequestBody = RegisterCandidate | null | undefined;
type RegisterError = {
    readonly error: "invalid_payload";
} | {
    readonly error: "weak_password";
    readonly policy: PasswordPolicyResult;
} | {
    readonly error: "invitation_not_found_or_expired";
} | {
    readonly error: "user_exists";
} | {
    readonly error: "user_creation_failed";
};
type RegisterSuccess = {
    readonly id: string;
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly profileImageUrl: string | null;
};
export declare const postRegister: RequestHandler<Record<string, string>, RegisterSuccess | RegisterError, RegisterRequestBody>;
export {};
