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
import type { InvitationListRow } from "./invitations-helpers.js";

export type ErrorCause =
  | Error
  | { readonly message?: string }
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type DbError = { readonly _tag: "DbError"; readonly cause: Error };
export type MembershipRow = typeof departmentMemberships.$inferSelect;
export type InvitationActionError = DbError | { readonly _tag: "InvitationNotFound" };

const hasMessage = (value: ErrorCause): value is { readonly message: string } =>
  typeof value === "object"
  && value !== null
  && "message" in value
  && typeof (value as { readonly message?: string }).message === "string";

const serializeCause = (value: ErrorCause): string => {
  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
    || typeof value === "symbol"
  ) {
    return String(value);
  }
  const serialized = JSON.stringify(value);
  return typeof serialized === "string" ? serialized : "unknown_error";
};

const asDbError = (cause: ErrorCause): DbError => {
  if (cause instanceof Error) {
    return { _tag: "DbError", cause };
  }
  if (hasMessage(cause)) {
    return { _tag: "DbError", cause: new Error(cause.message) };
  }
  return { _tag: "DbError", cause: new Error(serializeCause(cause)) };
};

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
