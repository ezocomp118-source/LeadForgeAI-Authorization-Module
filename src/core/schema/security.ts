import {
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { users } from "./identity.js";

// CHANGE: Connect-pg-simple compatible session storage
// WHY: Provide module-owned source of truth for sessions table used by express-session store
// QUOTE(ТЗ): "формат столбцов должен быть: sid varchar primary key, sess jsonb not null, expire timestamp not null"
// REF: AUTH-SESSIONS-COMPAT
// FORMAT THEOREM: ∀s ∈ Sessions: persisted(s) → (s.sid ≠ null ∧ s.sess ≠ null ∧ s.expire ≠ null)
// PURITY: CORE
// INVARIANT: sid uniquely identifies serialized session payload with expiry
// COMPLEXITY: O(1) per session row
export const sessions = pgTable("sessions", {
	sid: varchar("sid", { length: 255 }).primaryKey(),
	sess: jsonb("sess").notNull(),
	expire: timestamp("expire", { withTimezone: false }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// CHANGE: Session telemetry separated from connect-pg-simple storage
// WHY: Preserve IP/geo/user-agent audit trail without conflicting with session store schema
// QUOTE(ТЗ): "можно вынести это в отдельную таблицу (например, auth_sessions_audit)"
// REF: AUTH-SESSIONS-AUDIT
// FORMAT THEOREM: ∀a ∈ AuthSessionAudits: persisted(a) → ∃u: user(u) ∧ u.id = a.userId
// PURITY: CORE
// INVARIANT: Each audit row binds a user, optional session sid, and issued_at instant
// COMPLEXITY: O(1) per audit row
export const authSessionAudits = pgTable("auth_sessions_audit", {
	id: uuid("id").defaultRandom().primaryKey(),
	sessionSid: varchar("session_sid", { length: 255 }).references(
		() => sessions.sid,
		{ onDelete: "set null", onUpdate: "cascade" },
	),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
	ipAddress: text("ip_address").notNull(),
	city: text("city"),
	country: text("country"),
	userAgent: text("user_agent"),
	issuedAt: timestamp("issued_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	signedOutAt: timestamp("signed_out_at", { withTimezone: true }),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const securityAlerts = pgTable("security_alerts", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull(),
	sessionId: uuid("session_id")
		.notNull()
		.references(() => authSessionAudits.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	alertType: text("alert_type").notNull(),
	description: text("description"),
	detectedAt: timestamp("detected_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type AuthSessionAuditRow = typeof authSessionAudits.$inferSelect;
export type SecurityAlertRow = typeof securityAlerts.$inferSelect;
