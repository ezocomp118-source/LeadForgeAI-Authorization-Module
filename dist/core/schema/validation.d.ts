export declare const userInsertSchema: import("effect/Schema").Struct<{
    id: import("effect/Schema").PropertySignature<"?:", string | undefined, "id", "?:", string | undefined, true, never>;
    firstName: import("effect/Schema").PropertySignature<"?:", string | undefined, "firstName", "?:", string | undefined, true, never>;
    lastName: import("effect/Schema").PropertySignature<"?:", string | undefined, "lastName", "?:", string | undefined, true, never>;
    email: import("effect/Schema").Schema<string, string, never>;
    phone: import("effect/Schema").PropertySignature<"?:", string | undefined, "phone", "?:", string | undefined, true, never>;
    workEmail: import("effect/Schema").PropertySignature<"?:", string | null | undefined, "workEmail", "?:", string | null | undefined, false, never>;
    workPhone: import("effect/Schema").PropertySignature<"?:", string | null | undefined, "workPhone", "?:", string | null | undefined, false, never>;
    profileImageUrl: import("effect/Schema").PropertySignature<"?:", string | null | undefined, "profileImageUrl", "?:", string | null | undefined, false, never>;
    passwordHash: import("effect/Schema").Schema<string, string, never>;
    emailVerifiedAt: import("effect/Schema").PropertySignature<"?:", Date | null | undefined, "emailVerifiedAt", "?:", string | null | undefined, false, never>;
    phoneVerifiedAt: import("effect/Schema").PropertySignature<"?:", Date | null | undefined, "phoneVerifiedAt", "?:", string | null | undefined, false, never>;
    createdAt: import("effect/Schema").PropertySignature<"?:", Date | undefined, "createdAt", "?:", string | undefined, true, never>;
    updatedAt: import("effect/Schema").PropertySignature<"?:", Date | undefined, "updatedAt", "?:", string | undefined, true, never>;
}>;
export declare const userSelectSchema: import("effect/Schema").Struct<{
    id: import("effect/Schema").Schema<string, string, never>;
    firstName: import("effect/Schema").Schema<string, string, never>;
    lastName: import("effect/Schema").Schema<string, string, never>;
    email: import("effect/Schema").Schema<string, string, never>;
    phone: import("effect/Schema").Schema<string, string, never>;
    workEmail: import("effect/Schema").Schema<string | null, string | null, never>;
    workPhone: import("effect/Schema").Schema<string | null, string | null, never>;
    profileImageUrl: import("effect/Schema").Schema<string | null, string | null, never>;
    passwordHash: import("effect/Schema").Schema<string, string, never>;
    emailVerifiedAt: import("effect/Schema").Schema<Date | null, Date | null, never>;
    phoneVerifiedAt: import("effect/Schema").Schema<Date | null, Date | null, never>;
    createdAt: import("effect/Schema").Schema<Date, string, never>;
    updatedAt: import("effect/Schema").Schema<Date, string, never>;
}>;
export declare const sessionInsertSchema: import("effect/Schema").Struct<{
    sid: import("effect/Schema").Schema<string, string, never>;
    sess: import("effect/Schema").Schema<(string | number | boolean | null) | {
        readonly [key: string]: unknown;
    } | readonly unknown[], (string | number | boolean | null) | {
        readonly [key: string]: unknown;
    } | readonly unknown[], never>;
    expire: import("effect/Schema").Schema<Date, string, never>;
    updatedAt: import("effect/Schema").PropertySignature<"?:", Date | undefined, "updatedAt", "?:", string | undefined, true, never>;
}>;
export declare const sessionSelectSchema: import("effect/Schema").Struct<{
    sid: import("effect/Schema").Schema<string, string, never>;
    sess: import("effect/Schema").Schema<(string | number | boolean | null) | {
        readonly [key: string]: unknown;
    } | readonly unknown[], (string | number | boolean | null) | {
        readonly [key: string]: unknown;
    } | readonly unknown[], never>;
    expire: import("effect/Schema").Schema<Date, string, never>;
    updatedAt: import("effect/Schema").Schema<Date, string, never>;
}>;
