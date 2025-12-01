import { match } from "ts-pattern";

import { isNullableString, isRecord, isString } from "./guards.js";
import type { ApiError } from "./http.js";
import type { InvitationStatus, InvitationView, JsonValue, MeProfile } from "./types.js";

type InvitationCandidate = {
  readonly id?: JsonValue;
  readonly email?: JsonValue;
  readonly firstName?: JsonValue;
  readonly lastName?: JsonValue;
  readonly department?: JsonValue;
  readonly position?: JsonValue;
  readonly status?: JsonValue;
  readonly expiresAt?: JsonValue;
  readonly createdAt?: JsonValue;
  readonly acceptedAt?: JsonValue;
  readonly invitedBy?: JsonValue;
  readonly token?: JsonValue;
};

const isInvitationStatusValue = (value: JsonValue): value is InvitationStatus =>
  isString(value)
  && ["pending", "accepted", "expired", "revoked"].some(
    (status) => status === value,
  );

const parseStatus = (
  statusRaw: JsonValue | undefined,
): InvitationStatus | null =>
  isInvitationStatusValue(statusRaw as JsonValue)
    ? (statusRaw as InvitationStatus)
    : null;

const readRequiredStrings = (
  candidate: InvitationCandidate,
): {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly invitedBy: string;
} | null => {
  if (
    !isString(candidate.id)
    || !isString(candidate.email)
    || !isString(candidate.firstName)
    || !isString(candidate.lastName)
    || !isString(candidate.invitedBy)
  ) {
    return null;
  }
  return {
    id: candidate.id,
    email: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    invitedBy: candidate.invitedBy,
  };
};

const hasValidOptionalFields = (candidate: InvitationCandidate): boolean => {
  const optionals = [
    candidate.department ?? null,
    candidate.position ?? null,
    candidate.expiresAt ?? null,
    candidate.createdAt ?? null,
    candidate.acceptedAt ?? null,
    candidate.token ?? null,
  ];
  return optionals.every((field) => isNullableString(field));
};

const toNullableString = (value: JsonValue | undefined): string | null => (value ?? null) as string | null;

const buildInvitationView = (
  candidate: InvitationCandidate,
  status: InvitationStatus,
): InvitationView | null => {
  const required = readRequiredStrings(candidate);
  if (!required || !hasValidOptionalFields(candidate)) {
    return null;
  }
  return {
    ...required,
    department: toNullableString(candidate.department),
    position: toNullableString(candidate.position),
    status,
    expiresAt: toNullableString(candidate.expiresAt),
    createdAt: toNullableString(candidate.createdAt),
    acceptedAt: toNullableString(candidate.acceptedAt),
    token: toNullableString(candidate.token),
  };
};

export const decodeInvitation = (value: JsonValue): InvitationView | null => {
  if (!isRecord(value)) return null;
  const candidate = value as InvitationCandidate;
  const status = parseStatus(candidate.status);
  return status ? buildInvitationView(candidate, status) : null;
};

export const decodeInvitationsResponse = (
  value: JsonValue,
): { readonly invitations: ReadonlyArray<InvitationView> } | null => {
  if (!isRecord(value) || !("invitations" in value)) {
    return null;
  }
  const listValue = (value as { invitations?: JsonValue }).invitations ?? null;
  if (!Array.isArray(listValue)) {
    return null;
  }
  const decoded = (listValue as ReadonlyArray<JsonValue>)
    .map(decodeInvitation)
    .filter((item): item is InvitationView => item !== null);
  return decoded.length === listValue.length ? { invitations: decoded } : null;
};

export const decodeCreateInvitationResponse = (
  value: JsonValue,
): { readonly token: string; readonly expiresAt: string } | null => {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value as { token?: JsonValue; expiresAt?: JsonValue };
  return isString(candidate.token) && isString(candidate.expiresAt)
    ? { token: candidate.token, expiresAt: candidate.expiresAt }
    : null;
};

export const decodeRevokeResponse = (
  value: JsonValue,
): {
  readonly id: string;
  readonly status: InvitationStatus;
  readonly revokedAt: string | null;
} | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, status, revokedAt } = value as {
    id?: JsonValue;
    status?: JsonValue;
    revokedAt?: JsonValue;
  };
  const statusValue = status ?? null;
  return isString(id)
      && isInvitationStatusValue(statusValue)
      && isNullableString(revokedAt)
    ? {
      id,
      status: statusValue,
      revokedAt: revokedAt,
    }
    : null;
};

export const decodeMe = (value: JsonValue): MeProfile | null => {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value as {
    id?: JsonValue;
    email?: JsonValue;
    firstName?: JsonValue;
    lastName?: JsonValue;
    profileImageUrl?: JsonValue;
  };
  return isString(candidate.id)
      && isString(candidate.email)
      && isString(candidate.firstName)
      && isString(candidate.lastName)
      && isNullableString(candidate.profileImageUrl)
    ? {
      id: candidate.id,
      email: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      profileImageUrl: candidate.profileImageUrl ?? null,
    }
    : null;
};

export const describeApiError = (error: ApiError): string =>
  match<ApiError, string>(error)
    .with({ _tag: "NetworkError" }, (err) => `Network error: ${err.reason}`)
    .with(
      { _tag: "DecodeError" },
      (err) => `Response decode failed: ${err.reason}`,
    )
    .with({ _tag: "ApiError" }, (err) => {
      if (err.error === "invalid_payload") {
        return "Payload rejected: check required fields.";
      }
      if (err.error === "forbidden") {
        return "Only admin/HR accounts can manage invitations.";
      }
      return `API error ${err.status}: ${err.error}`;
    })
    .exhaustive();
