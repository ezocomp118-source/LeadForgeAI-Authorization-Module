import type { InvitationStatus } from "../../core/schema/index.js";
import type { InvitationView } from "../../shared/invitations-types.js";
export type { InvitationQuery } from "../../shared/invitations-types.js";
export declare const DEFAULT_INVITE_EXPIRATION_HOURS = 72;
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
    readonly error: "invalid_payload" | "invalid_status" | "unauthorized" | "forbidden" | "invalid_invitation_id" | "invitation_not_found_or_expired";
};
export type InvitationsResponse = {
    readonly invitations: ReadonlyArray<InvitationView>;
};
export declare const invitationStatuses: ReadonlyArray<InvitationStatus>;
export declare const isInvitationStatus: (value: string) => value is InvitationStatus;
export declare const parseStatusFilter: (raw: string | readonly string[] | undefined) => InvitationStatus | null;
export declare const parseEmailFilter: (raw: string | readonly string[] | undefined) => string | null;
export declare const toIso: (value: Date | null) => string | null;
export declare const hashToken: (token: string) => string;
export declare const generateToken: () => {
    token: string;
    tokenHash: string;
};
export declare const deriveInvitationStatus: (status: InvitationStatus, expiresAt: Date | null, nowMs: number) => InvitationStatus;
export declare const toInvitationView: (row: InvitationListRow, nowMs: number) => InvitationView;
