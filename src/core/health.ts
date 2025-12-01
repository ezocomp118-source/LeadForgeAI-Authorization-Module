// CHANGE: Pure health computation without side effects
// WHY: Keep HTTP-independent status logic in functional core
// QUOTE(ТЗ): "Пока просто создай пустое Epress приложение"
// REF: REQ-HEALTH
// FORMAT THEOREM: ∀t ∈ ℝ⁺: t ≥ 0 → computeHealth(t).status = "ok"
// PURITY: CORE
// INVARIANT: status constant is always "ok"
// COMPLEXITY: O(1) time / O(1) space
export type HealthStatus = {
  readonly status: "ok";
  readonly timestamp: number;
};

/**
 * CHANGE: Pure health payload builder
 * WHY: Keep health computation deterministic for shell reuse
 * QUOTE(ТЗ): "Каждая функция — это теорема."
 * REF: REQ-HEALTH
 * FORMAT THEOREM: ∀t ≥ 0: computeHealth(t) = { status: "ok", timestamp: t }
 * PURITY: CORE
 * INVARIANT: status === "ok" ∧ timestamp === input
 * COMPLEXITY: O(1)
 */
export const computeHealth = (now: number): HealthStatus => ({
  status: "ok",
  timestamp: now,
});
