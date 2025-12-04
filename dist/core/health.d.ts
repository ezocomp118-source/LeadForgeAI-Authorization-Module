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
export declare const computeHealth: (now: number) => HealthStatus;
