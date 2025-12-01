import { Effect, pipe } from "effect";
import type { Express } from "express";
import type { Server } from "node:http";

import { createApp } from "../shell/app.js";

type ServerConfig = {
  readonly port: number;
};

type ServerInfo = {
  readonly port: number;
  readonly httpServer: Server;
};

type ServerError = {
  readonly _tag: "ServerError";
  readonly reason: string;
};

/**
 * CHANGE: Build typed server error from string reason
 * WHY: Preserve typed error channel for Effect without throwing
 * QUOTE(ТЗ): "Ошибки: типизированы в сигнатурах функций, не runtime exceptions"
 * REF: REQ-HTTP-SHELL
 * PURITY: CORE
 * INVARIANT: _tag === "ServerError"
 * COMPLEXITY: O(1)
 */
const serverError = (reason: string): ServerError => ({
  _tag: "ServerError",
  reason,
});

/**
 * CHANGE: Start listening via Effect.async while preserving cancelation
 * WHY: Avoid Promise/async while keeping typed success/error channels
 * QUOTE(ТЗ): "Запрещён async/await — используй Effect.gen / Effect.tryPromise."
 * REF: REQ-HTTP-SHELL
 * FORMAT THEOREM: ∀port > 0: listen(app, port) → Effect(ServerInfo ∨ ServerError)
 * PURITY: SHELL
 * EFFECT: Effect<ServerInfo, ServerError, never>
 * INVARIANT: If success, httpServer.address().port === port
 * COMPLEXITY: O(1)
 */
const listen = (
  app: Express,
  port: number,
): Effect.Effect<ServerInfo, ServerError> =>
  Effect.async<ServerInfo, ServerError>((resume) => {
    const httpServer = app.listen(port, (): void => {
      resume(Effect.succeed({ port, httpServer }));
    });

    httpServer.on("error", (err: Error): void => {
      resume(Effect.fail(serverError(err.message)));
    });

    return Effect.sync(() => {
      httpServer.close();
    });
  });

// CHANGE: Imperative shell that boots the HTTP server via Effect runtime
// WHY: Keep IO orchestration isolated from business logic
// QUOTE(ТЗ): "Пока просто создай пустое Epress приложение"
// REF: REQ-HTTP-SHELL
// FORMAT THEOREM: ∀cfg ∈ Config: startServer(cfg) → Either<ServerError, ServerInfo>
// PURITY: SHELL
// EFFECT: Effect<ServerInfo, ServerError, never>
// INVARIANT: Server starts exactly once and resource cleanup closes listener
// COMPLEXITY: O(1) startup
const startServer = (
  config: ServerConfig,
): Effect.Effect<ServerInfo, ServerError> =>
  pipe(
    Effect.sync(createApp),
    Effect.flatMap((app) => listen(app, config.port)),
  );

/**
 * CHANGE: Pure port parser with fallback
 * WHY: Deterministic config derivation keeps shell reproducible
 * QUOTE(ТЗ): "Чистые функции, неизменяемые данные"
 * REF: REQ-HTTP-SHELL
 * FORMAT THEOREM: ∀raw: parsePort(raw) ∈ ℕ⁺ ∧ parsePort(raw) ≥ 1
 * PURITY: CORE
 * INVARIANT: Returns 3000 if input is not a positive finite number
 * COMPLEXITY: O(1)
 */
const parsePort = (raw: string | undefined): number => {
  const candidate = Number(raw);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 3000;
};

/**
 * CHANGE: Imperative shell that boots the HTTP server via Effect runtime
 * WHY: Keep IO orchestration isolated from business logic
 * QUOTE(ТЗ): "FUNCTIONAL CORE, IMPERATIVE SHELL"
 * REF: REQ-HTTP-SHELL
 * FORMAT THEOREM: ∀cfg ∈ Config: startServer(cfg) → Either<ServerError, ServerInfo>
 * PURITY: SHELL
 * EFFECT: Effect<ServerInfo, ServerError, never>
 * INVARIANT: Server starts at provided port or fails with typed reason
 * COMPLEXITY: O(1) startup
 */
const { PORT } = process.env;
const program = startServer({ port: parsePort(PORT) });

const logFailure = (cause: ServerError): Effect.Effect<void> =>
  Effect.sync(() => {
    console.error("Server failed", cause);
  });

const logSuccess = (info: ServerInfo): Effect.Effect<void> =>
  Effect.sync(() => {
    console.log(`HTTP server listening on port ${info.port}`);
  });

Effect.runFork(
  pipe(program, Effect.tap(logSuccess), Effect.tapError(logFailure)),
);
