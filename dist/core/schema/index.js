// CHANGE: Aggregate exports for Drizzle schema definitions
// WHY: Provide a single entry point for drizzle-kit and application imports
// QUOTE(ТЗ): "Сделай что бы мы описывали бы TypeScript типы которые бы конертировались бы в SQL таблицы"
// REF: REQ-DB-IDENTITY
// PURITY: CORE
// COMPLEXITY: O(1) import indirection
export * from "./identity.js";
export * from "./people.js";
export * from "./projects.js";
export * from "./security.js";
export * from "./time.js";
export * from "./verification.js";
