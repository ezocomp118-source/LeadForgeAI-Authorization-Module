import { randomBytes } from "node:crypto";
import { hashVerificationToken } from "../../core/verification.js";
export const DEFAULT_INVITE_EXPIRATION_HOURS = 72;
export const invitationStatuses = [
    "pending",
    "accepted",
    "expired",
    "revoked",
];
export const isInvitationStatus = (value) => invitationStatuses.some((candidate) => candidate === value);
export const parseStatusFilter = (raw) => {
    if (typeof raw !== "string") {
        return null;
    }
    const normalized = raw.trim();
    return isInvitationStatus(normalized) ? normalized : null;
};
export const parseEmailFilter = (raw) => typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
export const toIso = (value) => value ? value.toISOString() : null;
export const hashToken = (token) => hashVerificationToken(token);
export const generateToken = () => {
    const token = randomBytes(32).toString("hex");
    return { token, tokenHash: hashToken(token) };
};
export const deriveInvitationStatus = (status, expiresAt, nowMs) => {
    if (status === "accepted" || status === "revoked" || status === "expired") {
        return status;
    }
    if (expiresAt && expiresAt.getTime() <= nowMs) {
        return "expired";
    }
    return "pending";
};
export const toInvitationView = (row, nowMs) => {
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
