import { date, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { PgTimestampBuilderInitial } from "drizzle-orm/pg-core/columns/timestamp";

import { departments, positions, users } from "./identity.js";

// CHANGE: Onboarding, profile enrichment, and employment change logs
// WHY: Persist invitation-driven registration, user-editable profile fields, and auditable admin-only employment moves
// QUOTE(ТЗ): "Приглашение отправляется Администратором на email..." / "Дата рождения, Фотография, Контактные мессенджеры"
// REF: REQ-ONBOARDING-PROFILE
// FORMAT THEOREM: ∀invite ∈ Invitations: invite.departmentId ∧ invite.positionId ∈ OrgStructure
// PURITY: CORE
// INVARIANT: Invitation token hashes are unique; employment changes preserve before/after values for departments and positions
// COMPLEXITY: O(1) per persisted onboarding artifact
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const messengerPlatform = pgEnum("messenger_platform", [
  "telegram",
  "whatsapp",
]);

// CHANGE: Builder for audit timestamps to avoid duplicated column definitions
// WHY: Keep jscpd clean while creating fresh column builders per table
// PURITY: CORE
type AuditTimestamps = {
  readonly createdAt: PgTimestampBuilderInitial<"created_at">;
  readonly updatedAt: PgTimestampBuilderInitial<"updated_at">;
};

const buildAuditTimestamps = (): AuditTimestamps => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const registrationInvitations = pgTable(
  "registration_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    // CHANGE: Persist raw token alongside hash for admin-side copy/link actions
    // WHY: UI requirements demand re-sharing pending tokens without regenerating hashes
    // QUOTE(ТЗ): "Действия: копировать токен (если pending)"
    // REF: REQ-INVITES-UI
    // FORMAT THEOREM: ∀invite ∈ Invitations: pending(invite) → tokenPlaintext(invite) ≠ null
    // PURITY: CORE
    // INVARIANT: tokenPlaintext length equals 64 hex chars for freshly issued invitations
    // COMPLEXITY: O(1) storage
    tokenPlaintext: text("token_plaintext"),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    status: invitationStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("registration_invitations_token_hash_unique").on(
      table.tokenHash,
    ),
  ],
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    birthDate: date("birth_date", { mode: "date" }),
    avatarUrl: text("avatar_url"),
    about: text("about"),
    ...buildAuditTimestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.userId], name: "user_profiles_pk" }),
  ],
);

export const userMessengers = pgTable(
  "user_messengers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    platform: messengerPlatform("platform").notNull(),
    handle: text("handle").notNull(),
    ...buildAuditTimestamps(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.platform],
      name: "user_messengers_pk",
    }),
  ],
);

// CHANGE: Employment change log to record admin-only updates of department/position/work contacts
// WHY: Satisfy audit requirement "История изменений критичных данных (отдел, должность) должна логироваться"
// QUOTE(ТЗ): "История изменений критичных данных (отдел, должность) должна логироваться."
// REF: REQ-EMPLOYMENT-HISTORY
// FORMAT THEOREM: ∀log ∈ EmploymentChangeLog: log.previous ≠ log.new → logged(log)
// PURITY: CORE
// INVARIANT: Each record preserves both before/after identifiers for department and position
// COMPLEXITY: O(1) per change event
export const employmentChangeLog = pgTable("employment_change_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  changedBy: uuid("changed_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  previousDepartmentId: uuid("previous_department_id").references(
    () => departments.id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    },
  ),
  newDepartmentId: uuid("new_department_id").references(() => departments.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  previousPositionId: uuid("previous_position_id").references(
    () => positions.id,
    { onDelete: "set null", onUpdate: "cascade" },
  ),
  newPositionId: uuid("new_position_id").references(() => positions.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  previousWorkEmail: text("previous_work_email"),
  newWorkEmail: text("new_work_email"),
  previousWorkPhone: text("previous_work_phone"),
  newWorkPhone: text("new_work_phone"),
  sourceInvitationId: uuid("source_invitation_id").references(
    () => registrationInvitations.id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    },
  ),
  reason: text("reason"),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RegistrationInvitationRow = typeof registrationInvitations.$inferSelect;
export type UserProfileRow = typeof userProfiles.$inferSelect;
export type UserMessengerRow = typeof userMessengers.$inferSelect;
export type EmploymentChangeRow = typeof employmentChangeLog.$inferSelect;
export type InvitationStatus = (typeof invitationStatus.enumValues)[number];
