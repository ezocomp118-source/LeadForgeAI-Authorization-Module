import { and, desc, eq, ilike } from "drizzle-orm";
import * as Effect from "effect/Effect";

import {
  type departmentMemberships,
  departments,
  type InvitationStatus,
  positions,
  registrationInvitations,
} from "../../core/schema/index.js";
import { db } from "../db.js";
import type { InvitePayload } from "./auth-helpers.js";
import { asDbError, type DbError, type ErrorCause } from "./db-error.js";
import type { InvitationListRow } from "./invitations-helpers.js";

export type MembershipRow = typeof departmentMemberships.$inferSelect;
export type InvitationActionError = DbError | { readonly _tag: "InvitationNotFound" };
export type { DbError } from "./db-error.js";

export const fetchInvitations = (
  statusFilter: InvitationStatus | null,
  emailFilter: string | null,
): Effect.Effect<ReadonlyArray<InvitationListRow>, DbError> =>
  Effect.tryPromise({
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
        .leftJoin(
          departments,
          eq(registrationInvitations.departmentId, departments.id),
        )
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
    catch: (cause) => asDbError(cause as ErrorCause),
  });

export const findMembershipByUserId = (
  userId: string,
): Effect.Effect<MembershipRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () =>
      db.query.departmentMemberships.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.userId, userId),
      }),
    catch: (cause) => asDbError(cause as ErrorCause),
  });

export const insertInvitation = (
  payload: InvitePayload,
  inviterId: string,
  token: string,
  tokenHash: string,
  expirationDate: Date,
): Effect.Effect<void, DbError> =>
  Effect.tryPromise({
    try: () =>
      db
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
    catch: (cause) => asDbError(cause as ErrorCause),
  });

export const revokePendingInvitation = (
  id: string,
): Effect.Effect<
  { readonly id: string; readonly status: InvitationStatus; readonly revokedAt: Date | null },
  InvitationActionError
> =>
  Effect.tryPromise({
    try: () =>
      db
        .update(registrationInvitations)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(registrationInvitations.id, id),
            eq(registrationInvitations.status, "pending"),
          ),
        )
        .returning({
          id: registrationInvitations.id,
          status: registrationInvitations.status,
          revokedAt: registrationInvitations.revokedAt,
        }),
    catch: (cause) => asDbError(cause as ErrorCause),
  }).pipe(
    Effect.flatMap((rows) =>
      rows[0]
        ? Effect.succeed(rows[0])
        : Effect.fail<InvitationActionError>({ _tag: "InvitationNotFound" })
    ),
  );
