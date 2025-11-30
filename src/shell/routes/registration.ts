import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { Request, RequestHandler, Response } from "express";

import {
	departmentMemberships,
	registrationInvitations,
	users,
} from "../../core/schema/index.js";
import { hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import {
	parseRegister,
	type RegisterCandidate,
	validatePasswordPolicy,
} from "./auth-helpers.js";

const hashToken = (token: string): string => hashVerificationToken(token);

const hashPassword = (password: string): string =>
	bcrypt.hashSync(password, 10);

const now = (): Date => new Date();

const respondError = (res: Response, status: number, error: string) => {
	res.status(status).json({ error });
	return null;
};

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

export const postRegister: RequestHandler = (req, res, next) => {
	const payload = parseRegister(req.body as RegisterCandidate);
	if (!payload) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	const policy = validatePasswordPolicy(payload.password);
	if (!policy.ok) {
		res.status(400).json({ error: "weak_password", policy });
		return;
	}
	const tokenHash = hashToken(payload.token);
	processRegistration(tokenHash, payload.password, req, res).catch(next);
};
