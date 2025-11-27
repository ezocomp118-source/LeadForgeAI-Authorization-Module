// CHANGE: Centralize shared development defaults (database + auth/verify env)
// WHY: Reuse the same defaults across scripts, drizzle, and smoke tests without repetition
// QUOTE(ТЗ): "Используй этот скрипт и везде укажи базу данных"
// REF: REQ-DEV-DATABASE-URL / REQ-VERIFY-ENV
// PURITY: CORE
// INVARIANT: Consumers read immutable constants; no side effects or env mutation
export const DEVELOPMENT_DATABASE_URL =
	"postgresql://neondb_owner:npg_CLwSE1mYJha5@ep-red-truth-aedljsn0.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

export const SHARED_ENV_DEFAULTS = {
	APP_URL: "http://localhost:3000",
	RESEND_API_KEY: "re_3FBfs3a9_8PbQVQioTjFQMNih8bPRS6pd",
	RESEND_FROM_EMAIL: "Support <no-reply@example.com>",
	EMAIL_VERIFICATION_TTL_MIN: "60",
	PHONE_VERIFICATION_TTL_MIN: "10",
	VERIFICATION_REQUEST_RATE_LIMIT_PER_HOUR: "5",
	PHONE_VERIFICATION_MAX_ATTEMPTS: "5",
	VERIFICATION_DEV_MODE: "true",
};

export const withSharedEnv = (
	env = process.env,
	defaults = SHARED_ENV_DEFAULTS,
) => ({
	...defaults,
	...env,
});
