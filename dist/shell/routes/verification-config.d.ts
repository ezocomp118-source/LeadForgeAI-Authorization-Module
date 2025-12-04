export declare const config: {
    emailTtlMinutes: number;
    phoneTtlMinutes: number;
    requestsPerHour: number;
    phoneMaxAttempts: number;
    devMode: boolean;
    appUrl: string;
    fromEmail: string;
    resendApiKey: string;
    emailOverride: string | undefined;
    requireEmailVerified: boolean;
    requirePhoneVerified: boolean;
};
export declare const verificationMessages: {
    readonly code_invalid: "Verification token or code is invalid or already used";
    readonly code_expired: "Verification token or code expired";
    readonly too_many_attempts: "Maximum verification attempts exceeded";
    readonly rate_limited: "Too many verification requests in the last hour";
};
export declare const verificationRequiredMessage = "Verification required by policy for this action";
