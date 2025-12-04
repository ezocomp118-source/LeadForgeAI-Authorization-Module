import type { RequestHandler } from "express";
export declare const requestPhoneVerification: RequestHandler;
export declare const confirmPhoneVerification: RequestHandler;
export declare const requireVerificationGuard: (requirements?: {
    readonly requireEmailVerified?: boolean;
    readonly requirePhoneVerified?: boolean;
}) => RequestHandler;
