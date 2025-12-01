import { randomBytes } from "node:crypto";

import type { InvitationStatus } from "../../core/schema/index.js";
import { hashVerificationToken } from "../../core/verification.js";
import type { InvitationView } from "../../shared/invitations-types.js";
export type { InvitationQuery } from "../../shared/invitations-types.js";

export const DEFAULT_INVITE_EXPIRATION_HOURS = 72;

export type InvitationListRow = {
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

export type InvitationError = {
  readonly error:
    | "invalid_payload"
    | "invalid_status"
    | "unauthorized"
    | "forbidden"
    | "invalid_invitation_id"
    | "invitation_not_found_or_expired";
};

export type InvitationsResponse = { readonly invitations: ReadonlyArray<InvitationView> };

export const invitationStatuses: ReadonlyArray<InvitationStatus> = [
  "pending",
  "accepted",
  "expired",
  "revoked",
];

export const isInvitationStatus = (value: string): value is InvitationStatus =>
  invitationStatuses.some((candidate) => candidate === value);

export const parseStatusFilter = (
  raw: string | readonly string[] | undefined,
): InvitationStatus | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim();
  return isInvitationStatus(normalized) ? normalized : null;
};

export const parseEmailFilter = (
  raw: string | readonly string[] | undefined,
): string | null => typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

export const toIso = (value: Date | null): string | null => value ? value.toISOString() : null;

export const hashToken = (token: string): string => hashVerificationToken(token);

export const generateToken = (): { token: string; tokenHash: string } => {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
};

export const deriveInvitationStatus = (
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

export const toInvitationView = (
  row: InvitationListRow,
  nowMs: number,
): InvitationView => {
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
