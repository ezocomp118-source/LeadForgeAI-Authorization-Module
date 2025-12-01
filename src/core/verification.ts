import { createHash } from "node:crypto";

import type { VerificationCodeRow } from "./schema/verification.js";

export type VerificationType = VerificationCodeRow["type"];

export type VerificationErrorCode =
  | "code_invalid"
  | "code_expired"
  | "too_many_attempts";

export type VerificationAttemptOutcome =
  | {
    readonly _tag: "Expired";
    readonly code: "code_expired";
  }
  | {
    readonly _tag: "TooManyAttempts";
    readonly code: "too_many_attempts";
    readonly attempts: number;
    readonly maxAttempts: number;
  }
  | {
    readonly _tag: "Invalid";
    readonly code: "code_invalid";
    readonly nextAttempts: number;
    readonly maxAttempts: number;
  }
  | {
    readonly _tag: "Verified";
    readonly code: null;
  };

type AttemptInput = {
  readonly storedHash: string;
  readonly providedHash: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly now: Date;
};

// CHANGE: Deterministic SHA-256 hash for verification tokens
// WHY: Persist only hashes while keeping comparison free from timing differences in storage
// QUOTE(ТЗ): "В БД хранится только хэш, исходное значение токена/кода не сохраняется."
// REF: REQ-VERIFY-CODES
// FORMAT THEOREM: ∀t ∈ Token: hash(t) = sha256(t)
// PURITY: CORE
// INVARIANT: Output length = 64 hex chars for any UTF-8 input
// COMPLEXITY: O(|token|)
export const hashVerificationToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

// CHANGE: Compute expiration timestamp from TTL minutes
// WHY: Keep TTL derivation pure and testable across both email and phone flows
// QUOTE(ТЗ): "TTL токена/кода настраиваемый через env."
// REF: REQ-VERIFY-TTL
// FORMAT THEOREM: ∀t ≥ 0, ttl ≥ 0: expiresAt(t, ttl) = t + ttl·60_000
// PURITY: CORE
// INVARIANT: Resulting date is strictly greater than input instant for ttl > 0
// COMPLEXITY: O(1)
export const computeExpiresAt = (nowMs: number, ttlMinutes: number): Date => new Date(nowMs + ttlMinutes * 60_000);

// CHANGE: Pure evaluation of verification attempt without side effects
// WHY: Separate decision logic from DB mutations to satisfy functional core boundary
// QUOTE(ТЗ): "Каждая функция — это теорема." / "Защита от перебора кодов (ограничение попыток)."
// REF: REQ-VERIFY-LOGIC
// FORMAT THEOREM: ∀attempt: decide(attempt) → Outcome ∈ {Expired, TooManyAttempts, Invalid, Verified}
// PURITY: CORE
// INVARIANT: attempts never decreases; success requires storedHash = providedHash ∧ not expired ∧ usedAt = null
// COMPLEXITY: O(1)
export const evaluateAttempt = ({
  storedHash,
  providedHash,
  attempts,
  maxAttempts,
  expiresAt,
  usedAt,
  now,
}: AttemptInput): VerificationAttemptOutcome => {
  if (usedAt !== null) {
    return {
      _tag: "Invalid",
      code: "code_invalid",
      nextAttempts: attempts,
      maxAttempts,
    };
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return { _tag: "Expired", code: "code_expired" };
  }
  if (attempts >= maxAttempts) {
    return {
      _tag: "TooManyAttempts",
      code: "too_many_attempts",
      attempts,
      maxAttempts,
    };
  }
  if (storedHash !== providedHash) {
    const nextAttempts = Math.min(attempts + 1, maxAttempts);
    return {
      _tag: "Invalid",
      code: "code_invalid",
      nextAttempts,
      maxAttempts,
    };
  }
  return { _tag: "Verified", code: null };
};

// CHANGE: Rate limit predicate for issued codes per time window
// WHY: Enforce bounded issuance per user without embedding storage concerns
// QUOTE(ТЗ): "Rate-limit на запросы токенов/кодов."
// REF: REQ-VERIFY-RATELIMIT
// FORMAT THEOREM: ∀n, limit ≥ 0: isLimited(n, limit) ⇔ n ≥ limit
// PURITY: CORE
// INVARIANT: Returns false when limit is Infinity; monotonic in n
// COMPLEXITY: O(1)
export const isRateLimited = (issuedInWindow: number, limit: number): boolean => issuedInWindow >= limit;
