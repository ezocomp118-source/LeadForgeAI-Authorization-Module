import type { InvitationStatus } from "../../src/core/schema/index.js";
import type { InvitationView } from "../../src/shared/invitations-types.js";

export type { InvitationStatus, InvitationView };

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

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
