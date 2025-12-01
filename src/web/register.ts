import { Effect } from "effect";

import { isRecord, isString } from "./guards.js";
import "./styles.css";
import { type ApiError, postJson } from "./http.js";
import type { JsonValue, PasswordPolicyFlags } from "./types.js";
import { requireElement, setInlineError, showToast, toggleHidden } from "./ui.js";

type RegisterSuccess = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
};

const isDivElement = (element: Element): element is HTMLDivElement => element instanceof HTMLDivElement;
const isInputElement = (element: Element): element is HTMLInputElement => element instanceof HTMLInputElement;
const isFormElement = (element: Element): element is HTMLFormElement => element instanceof HTMLFormElement;

const registerForm = requireElement("register-form", isFormElement);
const tokenInput = requireElement("register-token", isInputElement);
const passwordInput = requireElement("register-password", isInputElement);
const registerError = requireElement("register-error", isDivElement);
const registerSuccess = requireElement("register-success", isDivElement);
const toastRoot = requireElement("toast-root", isDivElement);

const decodeRegisterResponse = (value: JsonValue): RegisterSuccess | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, email, firstName, lastName } = value as {
    id?: JsonValue;
    email?: JsonValue;
    firstName?: JsonValue;
    lastName?: JsonValue;
  };
  const valid = [
    isString(id ?? null),
    isString(email ?? null),
    isString(firstName ?? null),
    isString(lastName ?? null),
  ].every(Boolean);
  if (!valid) {
    return null;
  }
  return {
    id: id as string,
    email: email as string,
    firstName: firstName as string,
    lastName: lastName as string,
  };
};

const readPolicy = (body: JsonValue): PasswordPolicyFlags | null => {
  if (!isRecord(body)) {
    return null;
  }
  const policy = (body as { policy?: JsonValue }).policy;
  if (!isRecord(policy)) {
    return null;
  }
  const candidates = policy;
  const readFlag = (key: keyof PasswordPolicyFlags): boolean | null => {
    const value = candidates[key];
    return typeof value === "boolean" ? value : null;
  };

  const tooShort = readFlag("tooShort");
  const missingLower = readFlag("missingLower");
  const missingUpper = readFlag("missingUpper");
  const missingDigit = readFlag("missingDigit");
  const missingSymbol = readFlag("missingSymbol");
  if (
    tooShort === null
    || missingLower === null
    || missingUpper === null
    || missingDigit === null
    || missingSymbol === null
  ) {
    return null;
  }
  return {
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

const describeRegisterError = (error: ApiError): string => {
  if (error._tag === "NetworkError") {
    return `Network issue: ${error.reason}`;
  }
  if (error._tag === "DecodeError") {
    return `Response decode failed: ${error.reason}`;
  }
  const apiError = error;
  if (apiError.error === "invalid_payload") {
    return "Please fill token and password.";
  }
  if (apiError.error === "invitation_not_found_or_expired") {
    return "Invitation not found or already expired.";
  }
  if (apiError.error === "weak_password") {
    return describeWeakPassword(apiError.body);
  }
  if (apiError.status === 409 && apiError.error === "user_exists") {
    return "User already exists for this invitation.";
  }
  return `API error ${apiError.status}: ${apiError.error}`;
};

const isApiError = (
  error: ApiError | JsonValue | undefined,
): error is ApiError =>
  typeof error === "object"
  && error !== null
  && "_tag" in (error as Record<string, JsonValue>)
  && typeof (error as { _tag?: JsonValue })._tag === "string";

const handleSubmit = (event: SubmitEvent) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  const password = passwordInput.value;
  if (token.length === 0 || password.length === 0) {
    setInlineError(registerError, "Token and password are required.");
    return;
  }
  setInlineError(registerError, null);
  toggleHidden(registerSuccess, true);
  Effect.runPromise(
    postJson("/api/auth/register", { token, password }, decodeRegisterResponse),
  )
    .then(() => {
      toggleHidden(registerSuccess, false);
      showToast(toastRoot, "Registration successful", "success");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 900);
    })
    .catch((error: ApiError | JsonValue | undefined) => {
      const message = isApiError(error)
        ? describeRegisterError(error)
        : "Unexpected error";
      setInlineError(registerError, message);
      showToast(toastRoot, message, "error");
    });
};

const prefillToken = () => {
  const token = new URLSearchParams(window.location.search).get("token");
  if (token && isString(token)) {
    tokenInput.value = token;
  }
};

const bootstrap = () => {
  prefillToken();
  registerForm.addEventListener("submit", handleSubmit);
};

bootstrap();
