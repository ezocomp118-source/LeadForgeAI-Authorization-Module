import { and, desc, eq, ilike } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { departments, positions, registrationInvitations, } from "../../core/schema/index.js";
import { db } from "../db.js";
import { asDbError } from "./db-error.js";
export const fetchInvitations = (statusFilter, emailFilter) => Effect.tryPromise({
    try: () => {
        const base = db
            .select({
            id: registrationInvitations.id,
            tokenPlaintext: registrationInvitations.tokenPlaintext,
            email: registrationInvitations.email,
            firstName: registrationInvitations.firstName,
            lastName: registrationInvitations.lastName,
            status: registrationInvitations.status,
            expiresAt: registrationInvitations.expiresAt,
            createdAt: registrationInvitations.createdAt,
            acceptedAt: registrationInvitations.acceptedAt,
            departmentName: departments.name,
            positionTitle: positions.title,
            invitedBy: registrationInvitations.invitedBy,
        })
            .from(registrationInvitations)
            .leftJoin(departments, eq(registrationInvitations.departmentId, departments.id))
            .leftJoin(positions, eq(registrationInvitations.positionId, positions.id));
        const statusCondition = statusFilter
            ? eq(registrationInvitations.status, statusFilter)
            : null;
        const emailCondition = emailFilter
            ? ilike(registrationInvitations.email, `%${emailFilter}%`)
            : null;
        const scoped = statusCondition && emailCondition
            ? base.where(and(statusCondition, emailCondition))
            : statusCondition
                ? base.where(statusCondition)
                : emailCondition
                    ? base.where(emailCondition)
                    : base;
        return scoped.orderBy(desc(registrationInvitations.createdAt));
    },
    catch: (cause) => asDbError(cause),
});
export const findMembershipByUserId = (userId) => Effect.tryPromise({
    try: () => db.query.departmentMemberships.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.userId, userId),
    }),
    catch: (cause) => asDbError(cause),
});
export const insertInvitation = (payload, inviterId, token, tokenHash, expirationDate) => Effect.tryPromise({
    try: () => db
        .insert(registrationInvitations)
        .values({
        email: payload.email.toLowerCase(),
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        departmentId: payload.departmentId,
        positionId: payload.positionId,
        tokenHash,
        tokenPlaintext: token,
        invitedBy: inviterId,
        expiresAt: expirationDate,
    })
        .onConflictDoNothing(),
    catch: (cause) => asDbError(cause),
});
export const revokePendingInvitation = (id) => Effect.tryPromise({
    try: () => db
        .update(registrationInvitations)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(and(eq(registrationInvitations.id, id), eq(registrationInvitations.status, "pending")))
        .returning({
        id: registrationInvitations.id,
        status: registrationInvitations.status,
        revokedAt: registrationInvitations.revokedAt,
    }),
    catch: (cause) => asDbError(cause),
}).pipe(Effect.flatMap((rows) => rows[0]
    ? Effect.succeed(rows[0])
    : Effect.fail({ _tag: "InvitationNotFound" })));
