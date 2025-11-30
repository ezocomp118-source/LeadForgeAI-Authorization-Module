import { pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
// CHANGE: Define organization identity primitives (users, departments, roles) as typed SQL tables
// WHY: Provide type-level guarantees for access control entities and enable Drizzle codegen
// QUOTE(ТЗ): "Сделай что бы мы описывали бы TypeScript типы которые бы конертировались бы в SQL таблицы"
// REF: REQ-DB-IDENTITY
// FORMAT THEOREM: ∀u ∈ Users: persisted(u) → u.departmentMembership ⊆ Departments
// PURITY: CORE
// INVARIANT: Email values are unique and normalized per user row
// COMPLEXITY: O(1) storage per inserted entity
export const systemRole = pgEnum("system_role", [
    "super_admin",
    "admin",
    "manager",
]);
export const departments = pgTable("departments", {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});
// CHANGE: Positions catalogue bound to departments
// WHY: Fix invariant that each invite assigns both department and position per ТЗ onboarding flow
// QUOTE(ТЗ): "Отдел (выбирает Администратор при отправке приглашения)" / "Должность (выбирает Администратор)"
// REF: REQ-IDENTITY-POSITION
// FORMAT THEOREM: ∀p ∈ Positions: p.departmentId ∈ Departments
// PURITY: CORE
// INVARIANT: (departmentId, title) is unique to avoid duplicate positions inside a department
// COMPLEXITY: O(1) per inserted position
export const positions = pgTable("positions", {
    id: uuid("id").defaultRandom().primaryKey(),
    departmentId: uuid("department_id")
        .notNull()
        .references(() => departments.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (table) => [
    uniqueIndex("positions_department_title_unique").on(table.departmentId, table.title),
]);
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull(),
    workEmail: text("work_email"),
    workPhone: text("work_phone"),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});
export const departmentMemberships = pgTable("department_memberships", {
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    departmentId: uuid("department_id")
        .notNull()
        .references(() => departments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    positionId: uuid("position_id")
        .notNull()
        .references(() => positions.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
    }),
    role: systemRole("role").notNull(),
    assignedBy: uuid("assigned_by").references(() => users.id, {
        onDelete: "set null",
        onUpdate: "cascade",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (table) => [
    primaryKey({
        columns: [table.userId, table.departmentId],
        name: "department_memberships_pk",
    }),
]);
