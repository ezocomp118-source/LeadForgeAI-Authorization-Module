import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// CHANGE: Security telemetry tables for session tracking and anomaly detection
// WHY: Persist login metadata to support suspicious activity detection (multiple geo-locations)
// QUOTE(ТЗ): "отображается ... IP-адрес ... Геолокация ... Устройство и браузер" / "подозрительной активности"
// REF: REQ-SEC-SESSIONS
// FORMAT THEOREM: ∀s ∈ Sessions: persisted(s) → ∃u: user(u) ∧ u.id = s.userId
// PURITY: CORE
// INVARIANT: Each session row binds to exactly one user and single issued_at instant
// COMPLEXITY: O(1) per session row
export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull(),
	ipAddress: text("ip_address").notNull(),
	city: text("city"),
	country: text("country"),
	userAgent: text("user_agent"),
	issuedAt: timestamp("issued_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	signedOutAt: timestamp("signed_out_at", { withTimezone: true }),
});

export const securityAlerts = pgTable("security_alerts", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull(),
	sessionId: uuid("session_id").notNull(),
	alertType: text("alert_type").notNull(),
	description: text("description"),
	detectedAt: timestamp("detected_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type SecurityAlertRow = typeof securityAlerts.$inferSelect;
