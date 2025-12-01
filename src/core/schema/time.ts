import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// CHANGE: Time accounting tables for shift tracking and task attribution
// WHY: Provide immutable audit of "Время в системе" vs "Активное рабочее время"
// QUOTE(ТЗ): "Учет времени ... Начать смену ... Завершить смену ... Время в системе и Активное рабочее время"
// REF: REQ-TIME-TRACKING
// FORMAT THEOREM: ∀t ∈ TimeEntries: duration(t) = activeSeconds(t) + pauseSeconds(t)
// PURITY: CORE
// INVARIANT: activeSeconds >= 0 ∧ pauseSeconds >= 0 ∧ totalSeconds >= activeSeconds
// COMPLEXITY: O(1) per entry
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  taskId: uuid("task_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  activeSeconds: integer("active_seconds").notNull().default(0),
  pauseSeconds: integer("pause_seconds").notNull().default(0),
  totalSeconds: integer("total_seconds").notNull().default(0),
  notes: text("notes"),
});

export const productivitySnapshots = pgTable("productivity_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  windowStartedAt: timestamp("window_started_at", {
    withTimezone: true,
  }).notNull(),
  windowEndedAt: timestamp("window_ended_at", { withTimezone: true }).notNull(),
  activeSeconds: integer("active_seconds").notNull().default(0),
  pauseSeconds: integer("pause_seconds").notNull().default(0),
  taskSeconds: integer("task_seconds").notNull().default(0),
  efficiencyRatio: numeric("efficiency_ratio", { precision: 5, scale: 2 })
    .notNull()
    .default("0.00"),
});

export type TimeEntryRow = typeof timeEntries.$inferSelect;
export type ProductivitySnapshotRow = typeof productivitySnapshots.$inferSelect;
