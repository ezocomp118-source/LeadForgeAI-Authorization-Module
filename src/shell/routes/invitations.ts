import { randomBytes } from "node:crypto";

import { and, desc, eq, ilike } from "drizzle-orm";
import type { RequestHandler } from "express";

import {
	type departmentMemberships,
	departments,
	type InvitationStatus,
	positions,
	registrationInvitations,
} from "../../core/schema/index.js";
import { hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import { type InviteCandidate, parseInvite } from "./auth-helpers.js";

const DEFAULT_INVITE_EXPIRATION_HOURS = 72;

type MembershipRole = typeof departmentMemberships.$inferSelect.role;

const adminRoles: ReadonlyArray<MembershipRole> = [
	"super_admin",
	"admin",
	"manager",
];

const hashToken = (token: string): string => hashVerificationToken(token);

const generateToken = (): { token: string; tokenHash: string } => {
	const token = randomBytes(32).toString("hex");
	return { token, tokenHash: hashToken(token) };
};

const deriveInvitationStatus = (
	status: InvitationStatus,
	expiresAt: Date | null,
	nowMs: number,
): InvitationStatus => {
	if (status === "accepted" || status === "revoked" || status === "expired") {
		return status;
	}
	if (expiresAt && expiresAt.getTime() <= nowMs) {
		return "expired";
	}
	return "pending";
};

const invitationStatuses: ReadonlyArray<InvitationStatus> = [
	"pending",
	"accepted",
	"expired",
	"revoked",
];

const isInvitationStatus = (value: string): value is InvitationStatus =>
	invitationStatuses.some((candidate) => candidate === value);

const parseStatusFilter = (
	raw: string | readonly string[] | undefined,
): InvitationStatus | null => {
	if (typeof raw !== "string") {
		return null;
	}
	const normalized = raw.trim();
	return isInvitationStatus(normalized) ? normalized : null;
};

const parseEmailFilter = (
	raw: string | readonly string[] | undefined,
): string | null =>
	typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

const toIso = (value: Date | null): string | null =>
	value ? value.toISOString() : null;

type InvitationListRow = {
	readonly id: string;
	readonly tokenPlaintext: string | null;
	readonly email: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly status: InvitationStatus;
	readonly expiresAt: Date | null;
	readonly createdAt: Date;
	readonly acceptedAt: Date | null;
	readonly departmentName: string | null;
	readonly positionTitle: string | null;
	readonly invitedBy: string;
};

const fetchInvitations = (
	statusFilter: InvitationStatus | null,
	emailFilter: string | null,
) => {
	const base = db
		.select({
			id: registrationInvitations.id,
			tokenPlaintext: registrationInvitations.tokenPlaintext,
			email: registrationInvitations.email,
			firstName: registrationInvitations.firstName,
			lastName: registrationInvitations.lastName,
			status: registrationInvitations.status,
			expiresAt: registrationInvitations.expiresAt,
			createdAt: registrationInvitations.createdAt,
			acceptedAt: registrationInvitations.acceptedAt,
			departmentName: departments.name,
			positionTitle: positions.title,
			invitedBy: registrationInvitations.invitedBy,
		})
		.from(registrationInvitations)
		.leftJoin(
			departments,
			eq(registrationInvitations.departmentId, departments.id),
		)
		.leftJoin(positions, eq(registrationInvitations.positionId, positions.id));

	const statusCondition = statusFilter
		? eq(registrationInvitations.status, statusFilter)
		: null;
	const emailCondition = emailFilter
		? ilike(registrationInvitations.email, `%${emailFilter}%`)
		: null;

	const scoped =
		statusCondition && emailCondition
			? base.where(and(statusCondition, emailCondition))
			: statusCondition
				? base.where(statusCondition)
				: emailCondition
					? base.where(emailCondition)
					: base;
	return scoped.orderBy(desc(registrationInvitations.createdAt));
};

const toInvitationView = (row: InvitationListRow, nowMs: number) => {
	const status = deriveInvitationStatus(row.status, row.expiresAt, nowMs);
	return {
		id: row.id,
		email: row.email,
		firstName: row.firstName,
		lastName: row.lastName,
		department: row.departmentName,
		position: row.positionTitle,
		status,
		expiresAt: toIso(row.expiresAt),
		createdAt: toIso(row.createdAt),
		acceptedAt: toIso(row.acceptedAt),
		invitedBy: row.invitedBy,
		token: status === "pending" ? (row.tokenPlaintext ?? null) : null,
	};
};

export const requireAdmin: RequestHandler = (req, res, next) => {
	const { userId } = req.session;
	if (!userId) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}
	db.query.departmentMemberships
		.findFirst({
			where: (tbl, { eq: eqFn }) => eqFn(tbl.userId, userId),
		})
		.then((membership) => {
			if (membership && adminRoles.includes(membership.role)) {
				next();
				return;
			}
			res.status(403).json({ error: "forbidden" });
		})
		.catch(next);
};

export const getInvitations: RequestHandler = (req, res, next) => {
	const { status, email } = req.query as {
		readonly status?: string | string[];
		readonly email?: string | string[];
	};
	const statusFilter = parseStatusFilter(status);
	if (status && !statusFilter) {
		res.status(400).json({ error: "invalid_status" });
		return;
	}
	const emailFilter = parseEmailFilter(email);
	fetchInvitations(statusFilter, emailFilter)
		.then((rows) => {
			const nowMs = Date.now();
			const invitations = rows.map((row) =>
				toInvitationView(row as InvitationListRow, nowMs),
			);
			res.json({ invitations });
		})
		.catch(next);
};

export const postInvitation: RequestHandler = (req, res, next) => {
	const inviterId = req.session.userId;
	if (!inviterId) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}
	const payload = parseInvite({
		...(req.body as InviteCandidate),
		invitedBy: inviterId,
	});
	if (!payload) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	const { token, tokenHash } = generateToken();
	const expiresAt = payload.expiresInHours ?? DEFAULT_INVITE_EXPIRATION_HOURS;
	const expirationDate = new Date(Date.now() + expiresAt * 60 * 60 * 1000);
	db.insert(registrationInvitations)
		.values({
			email: payload.email.toLowerCase(),
			firstName: payload.firstName,
			lastName: payload.lastName,
			phone: payload.phone,
			departmentId: payload.departmentId,
			positionId: payload.positionId,
			tokenHash,
			tokenPlaintext: token,
			invitedBy: inviterId,
			expiresAt: expirationDate,
		})
		.onConflictDoNothing()
		.then(() => {
			res.status(201).json({ token, expiresAt: expirationDate.toISOString() });
		})
		.catch(next);
};

export const revokeInvitation: RequestHandler = (req, res, next) => {
	const { id } = req.params;
	if (typeof id !== "string" || id.trim().length === 0) {
		res.status(400).json({ error: "invalid_invitation_id" });
		return;
	}
	db.update(registrationInvitations)
		.set({ status: "revoked", revokedAt: new Date() })
		.where(
			and(
				eq(registrationInvitations.id, id),
				eq(registrationInvitations.status, "pending"),
			),
		)
		.returning({
			id: registrationInvitations.id,
			status: registrationInvitations.status,
			revokedAt: registrationInvitations.revokedAt,
		})
		.then(([invitation]) => {
			if (!invitation) {
				res.status(404).json({ error: "invitation_not_found_or_expired" });
				return;
			}
			res.json({
				id: invitation.id,
				status: invitation.status,
				revokedAt: toIso(invitation.revokedAt ?? null),
			});
		})
		.catch(next);
};
