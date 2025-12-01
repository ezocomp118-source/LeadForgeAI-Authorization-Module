import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./identity.js";

// CHANGE: Verification artifacts for email/phone with immutable hashes and attempt counters
// WHY: Persist single-use tokens with TTL to support anti-bruteforce verification flows
// QUOTE(ТЗ): "Создать таблицу verification_codes ... хранить TTL и число попыток"
// REF: REQ-VERIFY-CODES
// FORMAT THEOREM: ∀c ∈ Codes: used(c) ∨ expired(c, t) ∨ remainingAttempts(c, t) ≥ 0
// PURITY: CORE
// INVARIANT: Each record is bound to one user and verification type; tokens are stored hashed
// COMPLEXITY: O(1) storage per verification issuance
export const verificationKind = pgEnum("verification_kind", ["email", "phone"]);

export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  type: verificationKind("type").notNull(),
  sentTo: text("sent_to").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  requestedIp: text("requested_ip"),
  requestedUserAgent: text("requested_user_agent"),
  confirmedIp: text("confirmed_ip"),
  confirmedUserAgent: text("confirmed_user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type VerificationCodeRow = typeof verificationCodes.$inferSelect;
