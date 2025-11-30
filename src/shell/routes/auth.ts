import bcrypt from "bcryptjs";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { db } from "../db.js";
import { type LoginCandidate, parseLogin } from "./auth-helpers.js";

export const isAuthenticated = (
	req: Request,
	res: Response,
	next: NextFunction,
): void => {
	if (req.session.userId) {
		next();
		return;
	}
	res.status(401).json({ error: "unauthorized" });
};

const respondError = (res: Response, status: number, error: string) => {
	res.status(status).json({ error });
	return null;
};

const toUserPayload = (user: {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	profileImageUrl: string | null;
	emailVerifiedAt: Date | null;
	phoneVerifiedAt: Date | null;
}) => ({
	id: user.id,
	email: user.email,
	firstName: user.firstName,
	lastName: user.lastName,
	profileImageUrl: user.profileImageUrl ?? null,
	emailVerified: user.emailVerifiedAt !== null,
	phoneVerified: user.phoneVerifiedAt !== null,
});

const verifyPassword = (password: string, passwordHash: string): boolean =>
	bcrypt.compareSync(password, passwordHash);

const findUserByEmail = (email: string) =>
	db.query.users.findFirst({
		where: (tbl, { eq: eqFn }) => eqFn(tbl.email, email),
	});

const findUserById = (id: string) =>
	db.query.users.findFirst({
		where: (tbl, { eq: eqFn }) => eqFn(tbl.id, id),
	});

export const postLogin: RequestHandler = (req, res, next) => {
	const payload = parseLogin(req.body as LoginCandidate);
	if (!payload) {
		res.status(400).json({ error: "invalid_payload" });
		return;
	}
	findUserByEmail(payload.email.toLowerCase())
		.then((user) => {
			if (!user) {
				return respondError(res, 401, "invalid_credentials");
			}
			if (!verifyPassword(payload.password, user.passwordHash)) {
				return respondError(res, 401, "invalid_credentials");
			}
			req.session.userId = user.id;
			res.json(toUserPayload(user));
			return user;
		})
		.catch(next);
};

export const postLogout: RequestHandler = (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			res.status(500).json({ error: "logout_failed" });
			return;
		}
		res.status(204).end();
	});
};

export const getMe: RequestHandler = (req, res, next) => {
	if (!req.session.userId) {
		res.status(401).json({ error: "unauthorized" });
		return;
	}
	findUserById(req.session.userId)
		.then((user) => {
			if (!user) {
				res.status(404).json({ error: "user_not_found" });
				return;
			}
			res.json(toUserPayload(user));
		})
		.catch(next);
};
