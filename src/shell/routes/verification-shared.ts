import { randomBytes } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { match } from "ts-pattern";

import {
	users,
	type VerificationCodeRow,
	verificationCodes,
} from "../../core/schema/index.js";
import {
	evaluateAttempt,
	hashVerificationToken,
	isRateLimited,
	type VerificationAttemptOutcome,
} from "../../core/verification.js";
import { db } from "../db.js";

export type VerificationErrorCode =
	| "code_invalid"
	| "code_expired"
	| "too_many_attempts"
	| "rate_limited";

export type VerificationType = VerificationCodeRow["type"];

export type VerificationRequestResponse = {
	readonly status: "ok";
	readonly alreadyVerified?: boolean;
	readonly emailVerified?: boolean;
	readonly phoneVerified?: boolean;
	readonly devVerifyUrl?: string;
	readonly devCode?: string;
};

export const now = (): Date => new Date();

const asPositiveInt = (value: string | undefined, fallback: number): number => {
	const numeric = Number(value);
	return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
};

type VerificationEnv = {
	readonly APP_URL?: string;
	readonly RESEND_API_KEY?: string;
	readonly RESEND_FROM_EMAIL?: string;
	readonly EMAIL_VERIFICATION_TTL_MIN?: string;
	readonly PHONE_VERIFICATION_TTL_MIN?: string;
	readonly VERIFICATION_REQUEST_RATE_LIMIT_PER_HOUR?: string;
	readonly PHONE_VERIFICATION_MAX_ATTEMPTS?: string;
	readonly VERIFICATION_DEV_MODE?: string;
	readonly VERIFICATION_EMAIL_OVERRIDE?: string;
	readonly REQUIRE_VERIFIED_EMAIL?: string;
	readonly REQUIRE_VERIFIED_PHONE?: string;
};

const env = process.env as VerificationEnv;

const readEnvBoolean = (
	key: keyof VerificationEnv,
	fallback: boolean,
): boolean => {
	const raw = env[key];
	if (raw === undefined) {
		return fallback;
	}
	return raw.toLowerCase() === "true";
};

export const config = {
	emailTtlMinutes: asPositiveInt(env.EMAIL_VERIFICATION_TTL_MIN, 60),
	phoneTtlMinutes: asPositiveInt(env.PHONE_VERIFICATION_TTL_MIN, 10),
	requestsPerHour: asPositiveInt(
		env.VERIFICATION_REQUEST_RATE_LIMIT_PER_HOUR,
		5,
	),
	phoneMaxAttempts: asPositiveInt(env.PHONE_VERIFICATION_MAX_ATTEMPTS, 5),
	devMode: readEnvBoolean("VERIFICATION_DEV_MODE", false),
	appUrl: env.APP_URL ?? "http://localhost:3000",
	fromEmail: env.RESEND_FROM_EMAIL ?? "",
	resendApiKey: env.RESEND_API_KEY ?? "",
	emailOverride: env.VERIFICATION_EMAIL_OVERRIDE,
	requireEmailVerified: readEnvBoolean("REQUIRE_VERIFIED_EMAIL", false),
	requirePhoneVerified: readEnvBoolean("REQUIRE_VERIFIED_PHONE", false),
};

export const verificationMessages: Record<VerificationErrorCode, string> = {
	code_invalid: "Verification token or code is invalid or already used",
	code_expired: "Verification token or code expired",
	too_many_attempts: "Maximum verification attempts exceeded",
	rate_limited: "Too many verification requests in the last hour",
};

export const verificationRequiredMessage =
	"Verification required by policy for this action";

export const respondVerificationError = (
	res: Response,
	status: number,
	code: VerificationErrorCode,
) => {
	res.status(status).json({
		error: {
			code,
			message: verificationMessages[code],
		},
	});
	return null;
};

export const ensureAuthenticated = (
	req: Request,
	res: Response,
): string | null => {
	const { userId } = req.session;
	if (!userId) {
		res.status(401).json({ error: "unauthorized" });
		return null;
	}
	return userId;
};

export const findUserById = (id: string) =>
	db.query.users.findFirst({
		where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
	});

export const countRecentRequests = (userId: string, type: VerificationType) => {
	const cutoff = new Date(now().getTime() - 60 * 60 * 1000);
	return db
		.select({ value: sql<number>`count(*)` })
		.from(verificationCodes)
		.where(
			and(
				eq(verificationCodes.userId, userId),
				eq(verificationCodes.type, type),
				gt(verificationCodes.createdAt, cutoff),
			),
		)
		.then(([row]) => row?.value ?? 0);
};

export const deactivateActiveCodes = (userId: string, type: VerificationType) =>
	db
		.update(verificationCodes)
		.set({ usedAt: now() })
		.where(
			and(
				eq(verificationCodes.userId, userId),
				eq(verificationCodes.type, type),
				isNull(verificationCodes.usedAt),
			),
		);

export const insertVerificationCode = (
	params: Omit<
		VerificationCodeRow,
		"id" | "createdAt" | "usedAt" | "attempts"
	> & { readonly attempts?: number },
) =>
	db
		.insert(verificationCodes)
		.values({
			...params,
			attempts: params.attempts ?? 0,
		})
		.returning()
		.then(([row]) => row ?? null);

export const updateAttempts = (id: string, attempts: number) =>
	db
		.update(verificationCodes)
		.set({ attempts })
		.where(eq(verificationCodes.id, id));

const markVerifiedField = (
	code: VerificationCodeRow,
	timestamp: Date,
	field: "emailVerifiedAt" | "phoneVerifiedAt",
	metadata: { readonly ip?: string; readonly userAgent?: string },
) =>
	db.transaction((tx) =>
		tx
			.update(users)
			.set(
				field === "emailVerifiedAt"
					? { emailVerifiedAt: timestamp, updatedAt: timestamp }
					: { phoneVerifiedAt: timestamp, updatedAt: timestamp },
			)
			.where(eq(users.id, code.userId))
			.then(() =>
				tx
					.update(verificationCodes)
					.set({
						usedAt: timestamp,
						confirmedIp: metadata.ip,
						confirmedUserAgent: metadata.userAgent,
					})
					.where(eq(verificationCodes.id, code.id)),
			),
	);

export const markEmailVerified = (
	code: VerificationCodeRow,
	timestamp: Date,
	metadata: { readonly ip?: string; readonly userAgent?: string },
) => markVerifiedField(code, timestamp, "emailVerifiedAt", metadata);

export const markPhoneVerified = (
	code: VerificationCodeRow,
	timestamp: Date,
	metadata: { readonly ip?: string; readonly userAgent?: string },
) => markVerifiedField(code, timestamp, "phoneVerifiedAt", metadata);

export const evaluateOutcome = (
	code: VerificationCodeRow,
	providedHash: string,
): VerificationAttemptOutcome =>
	evaluateAttempt({
		storedHash: code.tokenHash,
		providedHash,
		attempts: code.attempts,
		maxAttempts: code.maxAttempts,
		expiresAt: code.expiresAt,
		usedAt: code.usedAt ?? null,
		now: now(),
	});

export const ensureRateLimit = (
	userId: string,
	type: VerificationType,
	res: Response,
) =>
	countRecentRequests(userId, type).then((recent) =>
		isRateLimited(recent, config.requestsPerHour)
			? respondVerificationError(res, 429, "rate_limited")
			: recent,
	);

export const ensureUserExists = (
	userPromise: ReturnType<typeof findUserById>,
	res: Response,
) =>
	userPromise.then((user) => {
		if (!user) {
			res.status(404).json({ error: "user_not_found" });
			return null;
		}
		return user;
	});

export const withExistingUser = <T>(
	res: Response,
	userPromise: ReturnType<typeof findUserById>,
	onUser: (user: NonNullable<Awaited<ReturnType<typeof findUserById>>>) => T,
) =>
	ensureUserExists(userPromise, res).then((user) =>
		user ? onUser(user) : null,
	);

export type RequestContext = {
	readonly userId: string;
	readonly ip: string | null;
	readonly userAgent: string | null;
};

export const extractRequestInfo = (
	req: Request,
): Omit<RequestContext, "userId"> =>
	({
		ip: typeof req.ip === "string" ? req.ip : null,
		userAgent:
			typeof req.headers["user-agent"] === "string"
				? req.headers["user-agent"]
				: null,
	}) satisfies Omit<RequestContext, "userId">;

export const withAuthenticatedUser = (
	req: Request,
	res: Response,
	next: (err?: Error) => void,
	onUser: (
		user: NonNullable<Awaited<ReturnType<typeof findUserById>>>,
		ctx: RequestContext,
	) => void,
): void => {
	const userId = ensureAuthenticated(req, res);
	if (!userId) {
		return;
	}
	const ctx: RequestContext = { userId, ...extractRequestInfo(req) };
	void withExistingUser(res, findUserById(userId), (user) => {
		onUser(user, ctx);
	})
		.then(() => undefined)
		.catch(next);
};

type InvalidOutcome = Extract<VerificationAttemptOutcome, { _tag: "Invalid" }>;

export const handleOutcome = (
	outcome: VerificationAttemptOutcome,
	res: Response,
	onInvalid: (invalid: InvalidOutcome) => void,
	onVerified: () => void,
) =>
	match(outcome)
		.with({ _tag: "Expired" }, () =>
			respondVerificationError(res, 400, "code_expired"),
		)
		.with({ _tag: "TooManyAttempts" }, () =>
			respondVerificationError(res, 400, "too_many_attempts"),
		)
		.with({ _tag: "Invalid" }, (invalid) => {
			onInvalid(invalid);
		})
		.with({ _tag: "Verified" }, onVerified)
		.exhaustive();

export const generateEmailToken = () => {
	const token = randomBytes(32).toString("hex");
	return { token, tokenHash: hashVerificationToken(token) };
};
