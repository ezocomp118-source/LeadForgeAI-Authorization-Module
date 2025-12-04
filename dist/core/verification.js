import { createHash } from "node:crypto";
// CHANGE: Deterministic SHA-256 hash for verification tokens
// WHY: Persist only hashes while keeping comparison free from timing differences in storage
// QUOTE(ТЗ): "В БД хранится только хэш, исходное значение токена/кода не сохраняется."
// REF: REQ-VERIFY-CODES
// FORMAT THEOREM: ∀t ∈ Token: hash(t) = sha256(t)
// PURITY: CORE
// INVARIANT: Output length = 64 hex chars for any UTF-8 input
// COMPLEXITY: O(|token|)
export const hashVerificationToken = (token) => createHash("sha256").update(token, "utf8").digest("hex");
// CHANGE: Compute expiration timestamp from TTL minutes
// WHY: Keep TTL derivation pure and testable across both email and phone flows
// QUOTE(ТЗ): "TTL токена/кода настраиваемый через env."
// REF: REQ-VERIFY-TTL
// FORMAT THEOREM: ∀t ≥ 0, ttl ≥ 0: expiresAt(t, ttl) = t + ttl·60_000
// PURITY: CORE
// INVARIANT: Resulting date is strictly greater than input instant for ttl > 0
// COMPLEXITY: O(1)
export const computeExpiresAt = (nowMs, ttlMinutes) => new Date(nowMs + ttlMinutes * 60_000);
// CHANGE: Pure evaluation of verification attempt without side effects
// WHY: Separate decision logic from DB mutations to satisfy functional core boundary
// QUOTE(ТЗ): "Каждая функция — это теорема." / "Защита от перебора кодов (ограничение попыток)."
// REF: REQ-VERIFY-LOGIC
// FORMAT THEOREM: ∀attempt: decide(attempt) → Outcome ∈ {Expired, TooManyAttempts, Invalid, Verified}
// PURITY: CORE
// INVARIANT: attempts never decreases; success requires storedHash = providedHash ∧ not expired ∧ usedAt = null
// COMPLEXITY: O(1)
export const evaluateAttempt = ({ storedHash, providedHash, attempts, maxAttempts, expiresAt, usedAt, now, }) => {
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
export const isRateLimited = (issuedInWindow, limit) => issuedInWindow >= limit;
