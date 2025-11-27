import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { VerificationCodeRow } from "../../core/schema/index.js";
import {
	computeExpiresAt,
	hashVerificationToken,
} from "../../core/verification.js";
import { db } from "../db.js";
import {
	config,
	deactivateActiveCodes,
	ensureAuthenticated,
	ensureRateLimit,
	evaluateOutcome,
	extractRequestInfo,
	findUserById,
	handleOutcome,
	insertVerificationCode,
	markPhoneVerified,
	now,
	respondVerificationError,
	updateAttempts,
	verificationRequiredMessage,
	withAuthenticatedUser,
	withExistingUser,
} from "./verification-shared.js";

const generatePhoneCode = () => {
	const randomValue = randomBytes(4).readUInt32BE(0);
	const sixDigit = (randomValue % 900_000) + 100_000;
	const code = sixDigit.toString().padStart(6, "0");
	return { code, codeHash: hashVerificationToken(code) };
};

const concludePhoneConfirmation = (
	record: VerificationCodeRow,
	outcome: ReturnType<typeof evaluateOutcome>,
	res: Parameters<RequestHandler>[1],
	ip?: string | null,
	userAgent?: string | null,
) =>
	handleOutcome(
		outcome,
		res,
		(invalid) => {
			void updateAttempts(record.id, invalid.nextAttempts).then(() => {
				const limitReached = invalid.nextAttempts >= record.maxAttempts;
				respondVerificationError(
					res,
					400,
					limitReached ? "too_many_attempts" : "code_invalid",
				);
			});
		},
		() => {
			void markPhoneVerified(record, now(), {
				...(ip ? { ip } : {}),
				...(userAgent ? { userAgent } : {}),
			}).then(() =>
				res.status(200).json({ status: "ok", phoneVerified: true }),
			);
		},
	);

export const requestPhoneVerification: RequestHandler = (req, res, next) => {
	withAuthenticatedUser(req, res, next, (user, ctx) => {
		if (user.phoneVerifiedAt) {
			res.status(200).json({
				status: "ok",
				alreadyVerified: true,
				phoneVerified: true,
			});
			return;
		}
		void ensureRateLimit(user.id, "phone", res).then((allowed) => {
			if (allowed === null) {
				return null;
			}
			const { code, codeHash } = generatePhoneCode();
			const expiresAt = computeExpiresAt(
				now().getTime(),
				config.phoneTtlMinutes,
			);
			return deactivateActiveCodes(user.id, "phone")
				.then(() =>
					insertVerificationCode({
						userId: user.id,
						type: "phone",
						sentTo: user.phone,
						tokenHash: codeHash,
						expiresAt,
						maxAttempts: config.phoneMaxAttempts,
						requestedIp: ctx.ip,
						requestedUserAgent: ctx.userAgent,
						confirmedIp: null,
						confirmedUserAgent: null,
					}),
				)
				.then(() => {
					const payload = config.devMode
						? { status: "ok", devCode: code }
						: { status: "ok" };
					res.status(200).json(payload);
					return null;
				});
		});
	});
};

export const confirmPhoneVerification: RequestHandler = (req, res, next) => {
	const userId = ensureAuthenticated(req, res);
	if (!userId) {
		return;
	}
	const { code } = req.body as { readonly code?: string };
	if (typeof code !== "string" || code.trim().length === 0) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	const { ip, userAgent } = extractRequestInfo(req);
	const codeHash = hashVerificationToken(code);
	db.query.verificationCodes
		.findFirst({
			where: (tbl, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
				andFn(
					eqFn(tbl.userId, userId),
					eqFn(tbl.type, "phone"),
					isNullFn(tbl.usedAt),
				),
			orderBy: (tbl, { desc: descFn }) => [descFn(tbl.createdAt)],
		})
		.then((record) => {
			if (!record) {
				return respondVerificationError(res, 400, "code_invalid");
			}
			const outcome = evaluateOutcome(record, codeHash);
			return concludePhoneConfirmation(record, outcome, res, ip, userAgent);
		})
		.catch(next);
};

export const requireVerificationGuard =
	(
		requirements: {
			readonly requireEmailVerified?: boolean;
			readonly requirePhoneVerified?: boolean;
		} = {
			requireEmailVerified: config.requireEmailVerified,
			requirePhoneVerified: config.requirePhoneVerified,
		},
	): RequestHandler =>
	(req, res, next) => {
		const userId = ensureAuthenticated(req, res);
		if (!userId) {
			return;
		}
		withExistingUser(res, findUserById(userId), (user) => {
			const emailOk =
				requirements.requireEmailVerified === true
					? user.emailVerifiedAt !== null
					: true;
			const phoneOk =
				requirements.requirePhoneVerified === true
					? user.phoneVerifiedAt !== null
					: true;
			if (emailOk && phoneOk) {
				next();
				return null;
			}
			res.status(403).json({
				error: {
					code: "verification_required",
					message: verificationRequiredMessage,
				},
				emailVerified: user.emailVerifiedAt !== null,
				phoneVerified: user.phoneVerifiedAt !== null,
			});
			return null;
		}).catch(next);
	};
