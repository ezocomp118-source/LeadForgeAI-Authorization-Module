import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import type { Request, RequestHandler, Response } from "express";
import { match } from "ts-pattern";

import { departmentMemberships, registrationInvitations, users } from "../../core/schema/index.js";
import { hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import {
  parseRegister,
  type PasswordPolicyResult,
  type RegisterCandidate,
  validatePasswordPolicy,
} from "./auth-helpers.js";
import { asDbError, type DbError, type ErrorCause } from "./db-error.js";
import { findUserByEmail, type UserRow } from "./user-queries.js";

type InvitationRow = typeof registrationInvitations.$inferSelect;

type RegisterRequestBody = RegisterCandidate | null | undefined;
type RegisterError =
  | { readonly error: "invalid_payload" }
  | { readonly error: "weak_password"; readonly policy: PasswordPolicyResult }
  | { readonly error: "invitation_not_found_or_expired" }
  | { readonly error: "user_exists" }
  | { readonly error: "user_creation_failed" };
type RegisterSuccess = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly profileImageUrl: string | null;
};
type TypedRequest = Request<Record<string, string>, RegisterSuccess | RegisterError, RegisterRequestBody>;
type TypedResponse = Response<RegisterSuccess | RegisterError>;

type RegistrationFlowError =
  | DbError
  | { readonly _tag: "InvitationNotFound" }
  | { readonly _tag: "UserExists" }
  | { readonly _tag: "UserCreationFailed" };

const hashToken = (token: string): string => hashVerificationToken(token);

const hashPassword = (password: string): string => bcrypt.hashSync(password, 10);

const now = (): Date => new Date();

const findActiveInvitation = (
  tokenHash: string,
): Effect.Effect<InvitationRow | undefined, DbError> =>
  Effect.tryPromise({
    try: () =>
      db.query.registrationInvitations.findFirst({
        where: (invites, { and, eq: eqFn, gt, isNull, or }) =>
          and(
            eqFn(invites.tokenHash, tokenHash),
            eqFn(invites.status, "pending"),
            or(isNull(invites.expiresAt), gt(invites.expiresAt, sql`now()`)),
          ),
      }),
    catch: (cause) => asDbError(cause as ErrorCause),
  });

const createUserFromInvitation = (
  invitation: InvitationRow,
  password: string,
): Effect.Effect<UserRow, RegistrationFlowError> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        db
          .insert(users)
          .values({
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            phone: invitation.phone,
            passwordHash: hashPassword(password),
          })
          .returning(),
      catch: (cause) => asDbError(cause as ErrorCause),
    }),
    Effect.flatMap((rows) =>
      rows[0]
        ? Effect.succeed(rows[0])
        : Effect.fail<RegistrationFlowError>({ _tag: "UserCreationFailed" })
    ),
  );

const createMembershipForInvitation = (
  invitation: InvitationRow,
  userId: string,
): Effect.Effect<void, DbError> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        db.insert(departmentMemberships).values({
          userId,
          departmentId: invitation.departmentId,
          positionId: invitation.positionId,
          role: "manager",
          assignedBy: invitation.invitedBy,
        }),
      catch: (cause) => asDbError(cause as ErrorCause),
    }),
    Effect.asVoid,
  );

const acceptInvitation = (
  invitationId: string,
  userId: string,
): Effect.Effect<void, DbError> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        db
          .update(registrationInvitations)
          .set({
            status: "accepted",
            acceptedAt: now(),
            consumedByUserId: userId,
          })
          .where(eq(registrationInvitations.id, invitationId)),
      catch: (cause) => asDbError(cause as ErrorCause),
    }),
    Effect.asVoid,
  );

// CHANGE: Registration workflow via Effect composition
// WHY: Remove Promise usage and enforce typed failures
// QUOTE(TZ): "Используй только Effect"
// PURITY: SHELL
// EFFECT: Effect<UserRow, RegistrationFlowError, never>
// INVARIANT: invitation.pending ∧ user absent → user created ∧ invitation accepted
// COMPLEXITY: O(1)
const registrationFlow = (
  tokenHash: string,
  password: string,
): Effect.Effect<UserRow, RegistrationFlowError> =>
  Effect.gen(function*(_) {
    const invitation = yield* _(findActiveInvitation(tokenHash));
    if (!invitation) {
      return yield* _(Effect.fail<RegistrationFlowError>({ _tag: "InvitationNotFound" }));
    }
    const existingUser = yield* _(findUserByEmail(invitation.email));
    if (existingUser) {
      return yield* _(Effect.fail<RegistrationFlowError>({ _tag: "UserExists" }));
    }
    const user = yield* _(createUserFromInvitation(invitation, password));
    yield* _(createMembershipForInvitation(invitation, user.id));
    yield* _(acceptInvitation(invitation.id, user.id));
    return user;
  });

const toUserPayload = (user: UserRow): RegisterSuccess => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  profileImageUrl: user.profileImageUrl ?? null,
});

// CHANGE: Register endpoint without Promise types
// WHY: Enforce functional core/imperative shell separation
// QUOTE(TZ): "Не используй Promise — используй Effect.Effect"
// PURITY: SHELL
// EFFECT: Effect<void, RegistrationFlowError, never>
// INVARIANT: valid payload ∧ policy.ok → registrationFlow executed
// COMPLEXITY: O(1)
export const postRegister: RequestHandler<
  Record<string, string>,
  RegisterSuccess | RegisterError,
  RegisterRequestBody
> = (req: TypedRequest, res: TypedResponse, next) => {
  const payload = parseRegister(req.body);
  if (!payload) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const policy = validatePasswordPolicy(payload.password);
  if (!policy.ok) {
    res.status(400).json({ error: "weak_password", policy });
    return;
  }
  const tokenHash = hashToken(payload.token);
  const program = pipe(
    registrationFlow(tokenHash, payload.password),
    Effect.tap((user) =>
      Effect.sync(() => {
        req.session.userId = user.id;
        res.status(201).json(toUserPayload(user));
      })
    ),
    Effect.catchAll((error) =>
      match<RegistrationFlowError, Effect.Effect<void>>(error)
        .with({ _tag: "InvitationNotFound" }, () =>
          Effect.sync(() => {
            res.status(404).json({ error: "invitation_not_found_or_expired" });
          }))
        .with({ _tag: "UserExists" }, () =>
          Effect.sync(() => {
            res.status(409).json({ error: "user_exists" });
          }))
        .with({ _tag: "UserCreationFailed" }, () =>
          Effect.sync(() => {
            res.status(500).json({ error: "user_creation_failed" });
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
