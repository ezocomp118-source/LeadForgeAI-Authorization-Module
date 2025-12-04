import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { match } from "ts-pattern";
import { departmentMemberships, registrationInvitations, users } from "../../core/schema/index.js";
import { hashVerificationToken } from "../../core/verification.js";
import { db } from "../db.js";
import { parseRegister, validatePasswordPolicy, } from "./auth-helpers.js";
import { asDbError } from "./db-error.js";
import { findUserByEmail } from "./user-queries.js";
const hashToken = (token) => hashVerificationToken(token);
const hashPassword = (password) => bcrypt.hashSync(password, 10);
const now = () => new Date();
const findActiveInvitation = (tokenHash) => Effect.tryPromise({
    try: () => db.query.registrationInvitations.findFirst({
        where: (invites, { and, eq: eqFn, gt, isNull, or }) => and(eqFn(invites.tokenHash, tokenHash), eqFn(invites.status, "pending"), or(isNull(invites.expiresAt), gt(invites.expiresAt, sql `now()`))),
    }),
    catch: (cause) => asDbError(cause),
});
const createUserFromInvitation = (invitation, password) => pipe(Effect.tryPromise({
    try: () => db
        .insert(users)
        .values({
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        phone: invitation.phone,
        passwordHash: hashPassword(password),
    })
        .returning(),
    catch: (cause) => asDbError(cause),
}), Effect.flatMap((rows) => rows[0]
    ? Effect.succeed(rows[0])
    : Effect.fail({ _tag: "UserCreationFailed" })));
const createMembershipForInvitation = (invitation, userId) => pipe(Effect.tryPromise({
    try: () => db.insert(departmentMemberships).values({
        userId,
        departmentId: invitation.departmentId,
        positionId: invitation.positionId,
        role: "manager",
        assignedBy: invitation.invitedBy,
    }),
    catch: (cause) => asDbError(cause),
}), Effect.asVoid);
const acceptInvitation = (invitationId, userId) => pipe(Effect.tryPromise({
    try: () => db
        .update(registrationInvitations)
        .set({
        status: "accepted",
        acceptedAt: now(),
        consumedByUserId: userId,
    })
        .where(eq(registrationInvitations.id, invitationId)),
    catch: (cause) => asDbError(cause),
}), Effect.asVoid);
// CHANGE: Registration workflow via Effect composition
// WHY: Remove Promise usage and enforce typed failures
// QUOTE(TZ): "Используй только Effect"
// PURITY: SHELL
// EFFECT: Effect<UserRow, RegistrationFlowError, never>
// INVARIANT: invitation.pending ∧ user absent → user created ∧ invitation accepted
// COMPLEXITY: O(1)
const registrationFlow = (tokenHash, password) => Effect.gen(function* (_) {
    const invitation = yield* _(findActiveInvitation(tokenHash));
    if (!invitation) {
        return yield* _(Effect.fail({ _tag: "InvitationNotFound" }));
    }
    const existingUser = yield* _(findUserByEmail(invitation.email));
    if (existingUser) {
        return yield* _(Effect.fail({ _tag: "UserExists" }));
    }
    const user = yield* _(createUserFromInvitation(invitation, password));
    yield* _(createMembershipForInvitation(invitation, user.id));
    yield* _(acceptInvitation(invitation.id, user.id));
    return user;
});
const toUserPayload = (user) => ({
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
export const postRegister = (req, res, next) => {
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
    const program = pipe(registrationFlow(tokenHash, payload.password), Effect.tap((user) => Effect.sync(() => {
        req.session.userId = user.id;
        res.status(201).json(toUserPayload(user));
    })), Effect.catchAll((error) => match(error)
        .with({ _tag: "InvitationNotFound" }, () => Effect.sync(() => {
        res.status(404).json({ error: "invitation_not_found_or_expired" });
    }))
        .with({ _tag: "UserExists" }, () => Effect.sync(() => {
        res.status(409).json({ error: "user_exists" });
    }))
        .with({ _tag: "UserCreationFailed" }, () => Effect.sync(() => {
        res.status(500).json({ error: "user_creation_failed" });
    }))
        .with({ _tag: "DbError" }, (dbErr) => Effect.sync(() => {
        next(dbErr.cause);
    }))
        .exhaustive()));
    Effect.runPromise(program).catch(next);
};
