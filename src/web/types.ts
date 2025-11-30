export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

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

export type MeProfile = {
	readonly id: string;
	readonly email: string;
	readonly firstName: string;
	readonly lastName: string;
	readonly profileImageUrl: string | null;
};

export type PasswordPolicyFlags = {
	readonly tooShort: boolean;
	readonly missingLower: boolean;
	readonly missingUpper: boolean;
	readonly missingDigit: boolean;
	readonly missingSymbol: boolean;
};

export const invitationStatusOrder: ReadonlyArray<InvitationStatus> = [
	"pending",
	"accepted",
	"expired",
	"revoked",
];
