import * as Effect from "effect/Effect";
import { type departmentMemberships, type InvitationStatus } from "../../core/schema/index.js";
import type { InvitePayload } from "./auth-helpers.js";
import { type DbError } from "./db-error.js";
import type { InvitationListRow } from "./invitations-helpers.js";
export type MembershipRow = typeof departmentMemberships.$inferSelect;
export type InvitationActionError = DbError | {
    readonly _tag: "InvitationNotFound";
};
export type { DbError } from "./db-error.js";
export declare const fetchInvitations: (statusFilter: InvitationStatus | null, emailFilter: string | null) => Effect.Effect<ReadonlyArray<InvitationListRow>, DbError>;
export declare const findMembershipByUserId: (userId: string) => Effect.Effect<MembershipRow | undefined, DbError>;
export declare const insertInvitation: (payload: InvitePayload, inviterId: string, token: string, tokenHash: string, expirationDate: Date) => Effect.Effect<void, DbError>;
export declare const revokePendingInvitation: (id: string) => Effect.Effect<{
    readonly id: string;
    readonly status: InvitationStatus;
    readonly revokedAt: Date | null;
}, InvitationActionError>;
