import { pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
// CHANGE: Project/space access model for fine-grained permission assignments
// WHY: Reflect "Проект/Рабочая группа" из ТЗ для точечного предоставления доступа
// QUOTE(ТЗ): "Использование сущности 'Проект' или 'Рабочая группа' для точечного предоставления доступа"
// REF: REQ-PROJECT-ACCESS
// FORMAT THEOREM: ∀m ∈ ProjectMembers: m.userId ∈ Users ∧ m.projectId ∈ Projects
// PURITY: CORE
// INVARIANT: Composite key enforces uniqueness of user-project membership
// COMPLEXITY: O(1) per membership row
export const projectRole = pgEnum("project_role", [
    "owner",
    "editor",
    "viewer",
]);
export const projects = pgTable("projects", {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    departmentId: uuid("department_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});
export const projectMembers = pgTable("project_members", {
    projectId: uuid("project_id")
        .notNull()
        .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    userId: uuid("user_id").notNull(),
    role: projectRole("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (table) => [
    primaryKey({
        columns: [table.projectId, table.userId],
        name: "project_members_pk",
    }),
]);
