import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { match } from "ts-pattern";
import { parseInvite } from "./auth-helpers.js";
import { fetchInvitations, findMembershipByUserId, insertInvitation, revokePendingInvitation, } from "./invitations-effect.js";
import { DEFAULT_INVITE_EXPIRATION_HOURS, generateToken, parseEmailFilter, parseStatusFilter, toInvitationView, toIso, } from "./invitations-helpers.js";
const adminRoles = [
    "super_admin",
    "admin",
    "manager",
];
const forwardDbErrors = (next) => (effect) => pipe(effect, Effect.catchAll((err) => Effect.sync(() => {
    next(err.cause);
})));
const runRouteProgram = (program, next) => {
    void Effect.runPromise(program).catch(next);
};
// CHANGE: Admin guard through Effect with typed DB errors
// WHY: Preserve pure core and explicit effect boundary
// QUOTE(TZ): "Мы всегда всё описываем реальными типами"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: userId ∈ session → adminRoles.includes(role) → next invoked
// COMPLEXITY: O(1)
export const requireAdmin = (req, res, next) => {
    const { userId } = req.session;
    if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }
    const program = pipe(findMembershipByUserId(userId), Effect.flatMap((membership) => membership && adminRoles.includes(membership.role)
        ? Effect.sync(() => {
            next();
        })
        : Effect.sync(() => {
            res.status(403).json({ error: "forbidden" });
        })), Effect.catchAll((err) => Effect.sync(() => {
        next(err.cause);
    })));
    Effect.runPromise(program).catch(next);
};
// CHANGE: Invitation listing via Effect without Promise chains
// WHY: Align with effectful shell and lint rules
// QUOTE(TZ): "Используй только Effect"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: Invalid filters short-circuit with 400
// COMPLEXITY: O(n) where n = invitations count
export const getInvitations = (req, res, next) => {
    const { status, email } = req.query;
    const statusFilter = parseStatusFilter(status);
    if (status && !statusFilter) {
        res.status(400).json({ error: "invalid_status" });
        return;
    }
    const emailFilter = parseEmailFilter(email);
    const program = pipe(fetchInvitations(statusFilter, emailFilter), Effect.map((rows) => {
        const nowMs = Date.now();
        return rows.map((row) => toInvitationView(row, nowMs));
    }), Effect.tap((invitations) => Effect.sync(() => {
        res.json({ invitations });
    })), forwardDbErrors(next));
    runRouteProgram(program, next);
};
export const postInvitation = (req, res, next) => {
    const inviterId = req.session.userId;
    if (!inviterId) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }
    const payload = parseInvite({
        ...req.body,
        invitedBy: inviterId,
    });
    if (!payload) {
        res.status(400).json({ error: "invalid_payload" });
        return;
    }
    const { token, tokenHash } = generateToken();
    const expiresAt = payload.expiresInHours ?? DEFAULT_INVITE_EXPIRATION_HOURS;
    const expirationDate = new Date(Date.now() + expiresAt * 60 * 60 * 1000);
    const program = pipe(insertInvitation(payload, inviterId, token, tokenHash, expirationDate), Effect.tap(() => Effect.sync(() => {
        res
            .status(201)
            .json({ token, expiresAt: expirationDate.toISOString() });
    })), forwardDbErrors(next));
    runRouteProgram(program, next);
};
// CHANGE: Invitation revocation without Promise chaining
// WHY: Keep effectful shell consistent across routes
// QUOTE(TZ): "Используй только Effect"
// PURITY: SHELL
// EFFECT: Effect<void, DbError, never>
// INVARIANT: id valid ∧ status=pending → status=revoked ∧ revokedAt!=null
// COMPLEXITY: O(1)
export const revokeInvitation = (req, res, next) => {
    const { id } = req.params;
    if (typeof id !== "string" || id.trim().length === 0) {
        res.status(400).json({ error: "invalid_invitation_id" });
        return;
    }
    const program = pipe(revokePendingInvitation(id), Effect.tap((invitation) => Effect.sync(() => {
        res.json({
            id: invitation.id,
            status: invitation.status,
            revokedAt: toIso(invitation.revokedAt ?? null),
        });
    })), Effect.catchAll((err) => match(err)
        .with({ _tag: "InvitationNotFound" }, () => Effect.sync(() => {
        res.status(404).json({ error: "invitation_not_found_or_expired" });
    }))
        .with({ _tag: "DbError" }, (dbErr) => Effect.sync(() => {
        next(dbErr.cause);
    }))
        .exhaustive()));
    runRouteProgram(program, next);
};
