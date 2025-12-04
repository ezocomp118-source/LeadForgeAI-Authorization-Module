import bcrypt from "bcryptjs";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { parseLogin } from "./auth-helpers.js";
import { findUserByEmail, findUserById } from "./user-queries.js";
export const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
        return;
    }
    res.status(401).json({ error: "unauthorized" });
};
const respondError = (res, status, error) => {
    res.status(status).json({ error });
};
const toUserPayload = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl ?? null,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
});
const verifyPassword = (password, passwordHash) => bcrypt.compareSync(password, passwordHash);
export const postLogin = (req, res, next) => {
    const payload = parseLogin(req.body);
    if (!payload) {
        res.status(400).json({ error: "invalid_payload" });
        return;
    }
    const program = pipe(findUserByEmail(payload.email.toLowerCase()), Effect.flatMap((user) => user
        ? verifyPassword(payload.password, user.passwordHash)
            ? Effect.sync(() => {
                req.session.userId = user.id;
                res.json(toUserPayload(user));
            })
            : Effect.fail({ _tag: "InvalidCredentials" })
        : Effect.fail({ _tag: "InvalidCredentials" })), Effect.catchAll((err) => err._tag === "InvalidCredentials"
        ? Effect.sync(() => {
            respondError(res, 401, "invalid_credentials");
        })
        : Effect.sync(() => {
            next(err.cause);
        })));
    Effect.runPromise(program).catch(next);
};
export const postLogout = (req, res) => {
    const handleDestroy = (err) => {
        if (err) {
            res.status(500).json({ error: "logout_failed" });
            return;
        }
        res.status(204).end();
    };
    req.session.destroy(handleDestroy);
};
export const getMe = (req, res, next) => {
    if (!req.session.userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }
    const program = pipe(findUserById(req.session.userId), Effect.flatMap((user) => user
        ? Effect.sync(() => {
            res.json(toUserPayload(user));
        })
        : Effect.sync(() => {
            res.status(404).json({ error: "user_not_found" });
        })), Effect.catchAll((err) => Effect.sync(() => {
        next(err.cause);
    })));
    Effect.runPromise(program).catch(next);
};
