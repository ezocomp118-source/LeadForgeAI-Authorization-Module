import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
	departmentMemberships,
	registrationInvitations,
	users,
} from "../../core/schema/index.js";
import { db } from "../db.js";
import {
	type InviteCandidate,
	type LoginCandidate,
	parseInvite,
	parseLogin,
	parseRegister,
	type RegisterCandidate,
	validatePasswordPolicy,
} from "./auth-helpers.js";

const hashToken = (token: string): string =>
	createHash("sha256").update(token).digest("hex");

const generateToken = (): { token: string; tokenHash: string } => {
	const token = randomBytes(32).toString("hex");
	return { token, tokenHash: hashToken(token) };
};

const hashPassword = (password: string): string =>
	bcrypt.hashSync(password, 10);

const verifyPassword = (password: string, passwordHash: string): boolean =>
	bcrypt.compareSync(password, passwordHash);

const now = (): Date => new Date();

export const isAuthenticated = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	if (req.session.userId) {
		next();
		return;
	}
	res.status(401).json({ error: "unauthorized" });
};

const respondError = (res: Response, status: number, error: string) => {
	res.status(status).json({ error });
	return null;
};

const DEFAULT_INVITE_EXPIRATION_HOURS = 72;

const findActiveInvitation = (tokenHash: string) =>
	db.query.registrationInvitations.findFirst({
		where: (invites, { and, eq: eqFn, gt, isNull, or }) =>
			and(
				eqFn(invites.tokenHash, tokenHash),
				eqFn(invites.status, "pending"),
				or(isNull(invites.expiresAt), gt(invites.expiresAt, sql`now()`)),
			),
	});

const findUserByEmail = (email: string) =>
	db.query.users.findFirst({
		where: (tbl, { eq: eqFn }) => eqFn(tbl.email, email),
	});

const findUserById = (id: string) =>
	db.query.users.findFirst({
		where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
	});

const ensureUserAvailable = (
	invitation: typeof registrationInvitations.$inferSelect,
	res: Response,
) =>
	findUserByEmail(invitation.email).then((existingUser) =>
		existingUser ? respondError(res, 409, "user_exists") : invitation,
	);

const createUserFromInvitation = (
	invitation: typeof registrationInvitations.$inferSelect,
	password: string,
) =>
	db
		.insert(users)
		.values({
			email: invitation.email,
			firstName: invitation.firstName,
			lastName: invitation.lastName,
			phone: invitation.phone,
			passwordHash: hashPassword(password),
		})
		.returning()
		.then(([user]) => (user ? { invitation, user } : null));

const createMembershipForInvitation = (
	invitation: typeof registrationInvitations.$inferSelect,
	userId: string,
) =>
	db.insert(departmentMemberships).values({
		userId,
		departmentId: invitation.departmentId,
		positionId: invitation.positionId,
		role: "manager",
		assignedBy: invitation.invitedBy,
	});

const acceptInvitation = (invitationId: string, userId: string) =>
	db
		.update(registrationInvitations)
		.set({
			status: "accepted",
			acceptedAt: now(),
			consumedByUserId: userId,
		})
		.where(eq(registrationInvitations.id, invitationId));

const processRegistration = (
	tokenHash: string,
	password: string,
	req: Request,
	res: Response,
) =>
	findActiveInvitation(tokenHash)
		.then(
			(invitation) =>
				invitation ?? respondError(res, 404, "invitation_not_found_or_expired"),
		)
		.then((invitation) =>
			invitation ? ensureUserAvailable(invitation, res) : null,
		)
		.then((invitation) =>
			invitation
				? createUserFromInvitation(invitation, password).then(
						(result) =>
							result ?? respondError(res, 500, "user_creation_failed"),
					)
				: null,
		)
		.then((result) =>
			result
				? createMembershipForInvitation(result.invitation, result.user.id).then(
						() => result,
					)
				: null,
		)
		.then((result) =>
			result
				? acceptInvitation(result.invitation.id, result.user.id).then(
						() => result.user,
					)
				: null,
		)
		.then((user) => {
			if (!user) {
				return;
			}
			req.session.userId = user.id;
			res.status(201).json({
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			});
		});

export const postInvitation: RequestHandler = (req, res, next) => {
	const payload = parseInvite(req.body as InviteCandidate);
	if (!payload) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	const { token, tokenHash } = generateToken();
	const expiresAt = payload.expiresInHours ?? DEFAULT_INVITE_EXPIRATION_HOURS;
	const expirationDate = new Date(now().getTime() + expiresAt * 60 * 60 * 1000);
	db.insert(registrationInvitations)
		.values({
			email: payload.email.toLowerCase(),
			firstName: payload.firstName,
			lastName: payload.lastName,
			phone: payload.phone,
			departmentId: payload.departmentId,
			positionId: payload.positionId,
			tokenHash,
			invitedBy: payload.invitedBy,
			expiresAt: expirationDate,
		})
		.onConflictDoNothing()
		.then(() => {
			res.status(201).json({ token, expiresAt: expirationDate.toISOString() });
		})
		.catch(next);
};

export const postRegister: RequestHandler = (req, res, next) => {
	const payload = parseRegister(req.body as RegisterCandidate);
	if (!payload) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	const policy = validatePasswordPolicy(payload.password);
	if (!policy.ok) {
		res.status(400).json({ error: "weak_password", reasons: policy.reasons });
		return;
	}
	const tokenHash = hashToken(payload.token);
	processRegistration(tokenHash, payload.password, req, res).catch(next);
};

export const postLogin: RequestHandler = (req, res, next) => {
	const payload = parseLogin(req.body as LoginCandidate);
	if (!payload) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	findUserByEmail(payload.email.toLowerCase())
		.then((user) => {
			if (!user) {
				return respondError(res, 401, "invalid_credentials");
			}
			if (!verifyPassword(payload.password, user.passwordHash)) {
				return respondError(res, 401, "invalid_credentials");
			}
			req.session.userId = user.id;
			res.json({
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			});
			return user;
		})
		.catch(next);
};

export const postLogout: RequestHandler = (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			res.status(500).json({ error: "logout_failed" });
			return;
		}
		res.status(204).end();
	});
};

export const getMe: RequestHandler = (req, res, next) => {
	if (!req.session.userId) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}
	findUserById(req.session.userId)
		.then((user) => {
			if (!user) {
				res.status(404).json({ error: "user_not_found" });
				return;
			}
			res.json({
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			});
		})
		.catch(next);
};
