import { and, desc, eq, ilike } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { RequestHandler } from "express";
import { match } from "ts-pattern";

import {
  type departmentMemberships,
  departments,
  type InvitationStatus,
  positions,
  registrationInvitations,
} from "../../core/schema/index.js";
import { db } from "../db.js";
import { type InviteCandidate, type InvitePayload, parseInvite } from "./auth-helpers.js";
import {
  DEFAULT_INVITE_EXPIRATION_HOURS,
  generateToken,
  type InvitationError,
  type InvitationListRow,
  type InvitationQuery,
  type InvitationsResponse,
  parseEmailFilter,
  parseStatusFilter,
  toIso,
  toInvitationView,
} from "./invitations-helpers.js";

type DbError = { readonly _tag: "DbError"; readonly cause: Error };
type InvitationActionError = DbError | { readonly _tag: "InvitationNotFound" };
type MembershipRole = typeof departmentMemberships.$inferSelect.role;
type MembershipRow = typeof departmentMemberships.$inferSelect;

const adminRoles: ReadonlyArray<MembershipRole> = [
  "super_admin",
  "admin",
  "manager",
];

const toError = (cause: unknown): Error => {
  if (cause instanceof Error) {
    return cause;
  }
  if (
    typeof cause === "object"
    && cause !== null
    && "message" in cause
    && typeof (cause as { readonly message?: string }).message === "string"
  ) {
    return new Error((cause as { readonly message: string }).message);
  }
  if (
    typeof cause === "string"
    || typeof cause === "number"
    || typeof cause === "boolean"
    || typeof cause === "bigint"
    || typeof cause === "symbol"
  ) {
    return new Error(String(cause));
  }
  const fallback = JSON.stringify(cause);
  return new Error(typeof fallback === "string" ? fallback : "unknown_error");
};

const asDbError = (cause: unknown): DbError => ({
  _tag: "DbError",
  cause: toError(cause),
});

// CHANGE: Fetch invitations with Effect to avoid Promise-based flows
// WHY: Enforce controlled effects and satisfy lint rule forbidding Promise types
// QUOTE(TZ): "Не используй Promise — используй Effect.Effect"
// PURITY: SHELL
// EFFECT: Effect<ReadonlyArray<InvitationListRow>, DbError, never>
// INVARIANT: ∀row ∈ result: row.status ∈ invitationStatuses
// COMPLEXITY: O(n) where n = result size
const fetchInvitations = (
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

const findMembershipByUserId = (
  userId: string,
): Effect.Effect<MembershipRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () =>
      db.query.departmentMemberships.findFirst({
        where: (tbl, { eq: eqFn }) => eqFn(tbl.userId, userId),
      }),
    catch: asDbError,
  });

// CHANGE: Admin guard through Effect with typed DB errors
// WHY: Preserve pure core and explicit effect boundary
// QUOTE(TZ): "Мы всегда всё описываем реальными типами"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: userId ∈ session → adminRoles.includes(role) → next invoked
// COMPLEXITY: O(1)
export const requireAdmin: RequestHandler = (req, res, next) => {
  const { userId } = req.session;
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const program = pipe(
    findMembershipByUserId(userId),
    Effect.flatMap((membership) =>
      membership && adminRoles.includes(membership.role)
        ? Effect.sync(() => {
          next();
        })
        : Effect.sync(() => {
          res.status(403).json({ error: "forbidden" });
        })
    ),
    Effect.catchAll((err) =>
      Effect.sync(() => {
        next(err.cause);
      })
    ),
  );
  Effect.runPromise(program).catch(next);
};

// CHANGE: Invitation listing via Effect without Promise chains
// WHY: Align with effectful shell and lint rules
// QUOTE(TZ): "Используй только Effect"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: Invalid filters short-circuit with 400
// COMPLEXITY: O(n) where n = invitations count
export const getInvitations: RequestHandler<
  Record<string, string>,
  InvitationsResponse | InvitationError,
  undefined,
  InvitationQuery
> = (req, res, next) => {
  const { status, email } = req.query;
  const statusFilter = parseStatusFilter(status);
  if (status && !statusFilter) {
    res.status(400).json({ error: "invalid_status" });
    return;
  }
  const emailFilter = parseEmailFilter(email);
  const program = pipe(
    fetchInvitations(statusFilter, emailFilter),
    Effect.map((rows) => {
      const nowMs = Date.now();
      return rows.map((row) => toInvitationView(row, nowMs));
    }),
    Effect.tap((invitations) =>
      Effect.sync(() => {
        res.json({ invitations });
      })
    ),
    Effect.catchAll((err) =>
      Effect.sync(() => {
        next(err.cause);
      })
    ),
  );
  Effect.runPromise(program).catch(next);
};

const insertInvitation = (
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

// CHANGE: Invitation creation through Effect pipeline
// WHY: Remove Promise usage and keep side effects isolated
// QUOTE(TZ): "Не используй Promise — используй Effect.Effect"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: inviterId ∈ session → invitation persisted once
// COMPLEXITY: O(1)
export const postInvitation: RequestHandler = (req, res, next) => {
  const inviterId = req.session.userId;
  if (!inviterId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const payload = parseInvite({
    ...(req.body as InviteCandidate),
    invitedBy: inviterId,
  });
  if (!payload) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const { token, tokenHash } = generateToken();
  const expiresAt = payload.expiresInHours ?? DEFAULT_INVITE_EXPIRATION_HOURS;
  const expirationDate = new Date(Date.now() + expiresAt * 60 * 60 * 1000);
  const program = pipe(
    insertInvitation(payload, inviterId, token, tokenHash, expirationDate),
    Effect.tap(() =>
      Effect.sync(() => {
        res
          .status(201)
          .json({ token, expiresAt: expirationDate.toISOString() });
      })
    ),
    Effect.catchAll((err) =>
      Effect.sync(() => {
        next(err.cause);
      })
    ),
  );
  Effect.runPromise(program).catch(next);
};

const revokePendingInvitation = (
  id: string,
): Effect.Effect<
  { readonly id: string; readonly status: InvitationStatus; readonly revokedAt: Date | null },
  InvitationActionError
> =>
  pipe(
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
    }),
    Effect.flatMap((rows) =>
      rows[0]
        ? Effect.succeed(rows[0])
        : Effect.fail<InvitationActionError>({ _tag: "InvitationNotFound" })
    ),
  );

// CHANGE: Invitation revocation without Promise chaining
// WHY: Keep effectful shell consistent across routes
// QUOTE(TZ): "Используй только Effect"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: id valid ∧ status=pending → status=revoked ∧ revokedAt!=null
// COMPLEXITY: O(1)
export const revokeInvitation: RequestHandler = (req, res, next) => {
  const { id } = req.params;
  if (typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({ error: "invalid_invitation_id" });
    return;
  }
  const program = pipe(
    revokePendingInvitation(id),
    Effect.tap((invitation) =>
      Effect.sync(() => {
        res.json({
          id: invitation.id,
          status: invitation.status,
          revokedAt: toIso(invitation.revokedAt ?? null),
        });
      })
    ),
    Effect.catchAll((err) =>
      match<InvitationActionError, Effect.Effect<void>>(err)
        .with({ _tag: "InvitationNotFound" }, () =>
          Effect.sync(() => {
            res.status(404).json({ error: "invitation_not_found_or_expired" });
          }))
        .with({ _tag: "DbError" }, (dbErr) =>
          Effect.sync(() => {
            next(dbErr.cause);
          }))
        .exhaustive()
    ),
  );
  Effect.runPromise(program).catch(next);
};
