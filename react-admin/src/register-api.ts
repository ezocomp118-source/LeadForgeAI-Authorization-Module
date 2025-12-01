import type { Effect } from "effect";

import { type ApiResult, toApiResult } from "./api.js";
import { describeTransportError } from "./error-describer.js";
import { isRecord, isString } from "./guards.js";
import type { ApiError } from "./http.js";
import { postJson } from "./http.js";
import type { JsonValue, PasswordPolicyFlags } from "./types.js";

export type RegisterSuccess = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
};

type PolicyEnvelope = Record<string, JsonValue> & { readonly policy: JsonValue };

const hasPolicyField = (value: JsonValue): value is PolicyEnvelope => isRecord(value) && "policy" in value;

const decodeRegisterResponse = (value: JsonValue): RegisterSuccess | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, email, firstName, lastName } = value;
  return isString(id)
      && isString(email)
      && isString(firstName)
      && isString(lastName)
    ? {
      id,
      email,
      firstName,
      lastName,
    }
    : null;
};

const readPolicy = (body: JsonValue): PasswordPolicyFlags | null => {
  if (!hasPolicyField(body)) {
    return null;
  }
  const policy = body.policy;
  if (!isRecord(policy)) {
    return null;
  }
  const pick = (key: keyof PasswordPolicyFlags): boolean | null => {
    const value = policy[key];
    return typeof value === "boolean" ? value : null;
  };
  const tooShort = pick("tooShort");
  const missingLower = pick("missingLower");
  const missingUpper = pick("missingUpper");
  const missingDigit = pick("missingDigit");
  const missingSymbol = pick("missingSymbol");
  return tooShort === null
      || missingLower === null
      || missingUpper === null
      || missingDigit === null
      || missingSymbol === null
    ? null
    : {
      tooShort,
      missingLower,
      missingUpper,
      missingDigit,
      missingSymbol,
    };
};

const describeWeakPassword = (body: JsonValue): string => {
  const policy = readPolicy(body);
  if (!policy) {
    return "Password does not meet complexity rules.";
  }
  const missing = [];
  if (policy.tooShort) missing.push("min length 12");
  if (policy.missingLower) missing.push("lowercase letter");
  if (policy.missingUpper) missing.push("uppercase letter");
  if (policy.missingDigit) missing.push("digit");
  if (policy.missingSymbol) missing.push("symbol");
  return `Weak password: missing ${missing.join(", ")}`;
};

export const describeRegisterError = (error: ApiError): string => {
  const transport = describeTransportError(error);
  if (transport !== null) {
    return transport;
  }
  if (error._tag !== "ApiError") {
    return "Unexpected error";
  }
  if (error.error === "invalid_payload") {
    return "Please fill token and password.";
  }
  if (error.error === "invitation_not_found_or_expired") {
    return "Invitation not found or already expired.";
  }
  if (error.error === "weak_password") {
    return describeWeakPassword(error.body);
  }
  if (error.status === 409 && error.error === "user_exists") {
    return "User already exists for this invitation.";
  }
  return `API error ${error.status}: ${error.error}`;
};

export const registerWithInvitation = (params: {
  readonly token: string;
  readonly password: string;
}): Effect.Effect<ApiResult<RegisterSuccess>> =>
  toApiResult(
    postJson("/api/auth/register", params, decodeRegisterResponse),
    describeRegisterError,
  );
