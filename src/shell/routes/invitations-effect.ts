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

const asDbError = (cause: unknown): DbError => {
  const candidate = cause as ErrorCause;
  if (cause instanceof Error) {
    return { _tag: "DbError", cause };
  }
  if (
    typeof candidate === "object"
    && candidate !== null
    && "message" in candidate
    && typeof (candidate as { readonly message?: string }).message === "string"
  ) {
    return {
      _tag: "DbError",
      cause: new Error((candidate as { readonly message: string }).message),
    };
  }
  const normalized = typeof candidate === "string"
      || typeof candidate === "number"
      || typeof candidate === "boolean"
      || typeof candidate === "bigint"
      || typeof candidate === "symbol"
    ? String(candidate)
    : (() => {
      const serialized = JSON.stringify(candidate);
      return typeof serialized === "string" ? serialized : "unknown_error";
    })();
  return { _tag: "DbError", cause: new Error(normalized) };
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
    catch: asDbError,
  });

export const findMembershipByUserId = (
  userId: string,
): Effect.Effect<MembershipRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () =>
      db.query.departmentMemberships.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.userId, userId),
      }),
    catch: asDbError,
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
    catch: asDbError,
  });

export const revokePendingInvitation = (
  id: string,
): Effect.Effect<
  { readonly id: string; readonly status: InvitationStatus; readonly revokedAt: Date | null },
  DbError
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
    catch: asDbError,
  }).pipe(
    Effect.flatMap((rows) =>
      rows[0]
        ? Effect.succeed(rows[0])
        : Effect.fail<DbError>({
          _tag: "DbError",
          cause: new Error("not_found"),
        })
    ),
  );
