import type { InvitationStatus } from "../core/schema/index.js";
export type InvitationView = {
    readonly id: string;
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly department: string | null;
    readonly position: string | null;
    readonly status: InvitationStatus;
    readonly expiresAt: string | null;
    readonly createdAt: string | null;
    readonly acceptedAt: string | null;
    readonly invitedBy: string;
    readonly token: string | null;
};
export type InvitationQuery = {
    readonly status?: string | string[];
    readonly email?: string | string[];
};
