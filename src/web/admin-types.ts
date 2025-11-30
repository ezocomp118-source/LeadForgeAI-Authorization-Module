import type { InvitationStatus, InvitationView, MeProfile } from "./types.js";

export type CreateInvitationResponse = {
	readonly token: string;
	readonly expiresAt: string;
};

export type Filters = { status: InvitationStatus | "all"; email: string };

export type AdminState = {
	invitations: ReadonlyArray<InvitationView>;
	filters: Filters;
	latest: CreateInvitationResponse | null;
	me: MeProfile | null;
};
