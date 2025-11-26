import express, { type Express, type Request, type Response } from "express";

import { computeHealth } from "../core/health.js";

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

	app.get("/health", (_req: Request, res: Response): void => {
		const payload = computeHealth(Date.now());
		res.status(200).json(payload);
	});

	return app;
};
