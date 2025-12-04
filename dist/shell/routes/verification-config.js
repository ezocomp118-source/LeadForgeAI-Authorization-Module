const env = process.env;
const asPositiveInt = (value, fallback) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
};
const readEnvBoolean = (key, fallback) => {
    const raw = env[key];
    if (raw === undefined) {
        return fallback;
    }
    return raw.toLowerCase() === "true";
};
export const config = {
    emailTtlMinutes: asPositiveInt(env.EMAIL_VERIFICATION_TTL_MIN, 60),
    phoneTtlMinutes: asPositiveInt(env.PHONE_VERIFICATION_TTL_MIN, 10),
    requestsPerHour: asPositiveInt(env.VERIFICATION_REQUEST_RATE_LIMIT_PER_HOUR, 5),
    phoneMaxAttempts: asPositiveInt(env.PHONE_VERIFICATION_MAX_ATTEMPTS, 5),
    devMode: readEnvBoolean("VERIFICATION_DEV_MODE", false),
    appUrl: env.APP_URL ?? "http://localhost:3000",
    fromEmail: env.RESEND_FROM_EMAIL ?? "",
    resendApiKey: env.RESEND_API_KEY ?? "",
    emailOverride: env.VERIFICATION_EMAIL_OVERRIDE,
    requireEmailVerified: readEnvBoolean("REQUIRE_VERIFIED_EMAIL", false),
    requirePhoneVerified: readEnvBoolean("REQUIRE_VERIFIED_PHONE", false),
};
export const verificationMessages = {
    code_invalid: "Verification token or code is invalid or already used",
    code_expired: "Verification token or code expired",
    too_many_attempts: "Maximum verification attempts exceeded",
    rate_limited: "Too many verification requests in the last hour",
};
export const verificationRequiredMessage = "Verification required by policy for this action";
