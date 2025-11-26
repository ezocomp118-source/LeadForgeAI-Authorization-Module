import express, { type Express, type Request, type Response } from "express";
import session from "express-session";
import swaggerUi from "swagger-ui-express";

import { computeHealth } from "../core/health.js";
import {
	getMe,
	isAuthenticated,
	postInvitation,
	postLogin,
	postLogout,
	postRegister,
} from "./routes/auth.js";
import { swaggerDocument } from "./swagger.js";

/**
 * CHANGE: Build Express application as imperative shell wrapping pure health logic
 * WHY: Isolate IO (HTTP) concerns from functional core to satisfy FC/IS separation
 * QUOTE(ТЗ): "FUNCTIONAL CORE, IMPERATIVE SHELL"
 * REF: REQ-HTTP-SHELL
 * FORMAT THEOREM: ∀req ∈ Requests: respondHealth(req) → HttpStatus(200)
 * PURITY: SHELL
 * EFFECT: Effect<void, never, HttpServer>
 * INVARIANT: Health endpoint never mutates server state
 * COMPLEXITY: O(1) handler per request
 */
export const createApp = (): Express => {
	const app = express();

	app.use(express.json());
	const { SESSION_SECRET: sessionSecret } = process.env;
	app.use(
		session({
			secret: sessionSecret ?? "insecure-session-secret",
			resave: false,
			saveUninitialized: false,
			cookie: {
				httpOnly: true,
				secure: false,
				sameSite: "lax",
			},
		}),
	);

	app.get("/health", (_req: Request, res: Response): void => {
		const payload = computeHealth(Date.now());
		res.status(200).json(payload);
	});

	app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

	app.post("/api/invitations", isAuthenticated, postInvitation);
	app.post("/api/register", postRegister);
	app.post("/api/auth/login", postLogin);
	app.post("/api/auth/logout", postLogout);
	app.get("/api/auth/me", isAuthenticated, getMe);

	return app;
};
