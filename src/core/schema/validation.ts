import { createInsertSchema, createSelectSchema } from "@handfish/drizzle-effect";

import { sessions, users } from "./index.js";

// CHANGE: Derive Effect schemas from Drizzle tables for typed validation
// WHY: Enable reuse of table shapes in functional validation without duplicating models
// QUOTE(ТЗ): "Используй ... @effect/schema ... обязательные библиотеки"
// REF: AUTH-SCHEMA-VALIDATION
// FORMAT THEOREM: ∀u ∈ Users: validate(u) ⇔ u satisfies table column domains
// PURITY: CORE
// INVARIANT: Refined email/first/last fields are trimmed strings (lowercased email)
// COMPLEXITY: O(n) over validated fields
export const userInsertSchema = createInsertSchema(users);
export const userSelectSchema = createSelectSchema(users);

export const sessionInsertSchema = createInsertSchema(sessions);
export const sessionSelectSchema = createSelectSchema(sessions);
