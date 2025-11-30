import { Effect, pipe } from "effect";

import type { JsonValue } from "./types.js";

type JsonDecoder<T> = (value: JsonValue) => T | null;

export type ApiError =
	| { readonly _tag: "NetworkError"; readonly reason: string }
	| {
			readonly _tag: "ApiError";
			readonly status: number;
			readonly error: string;
			readonly body: JsonValue;
	  }
	| { readonly _tag: "DecodeError"; readonly reason: string };

const isRecord = (value: JsonValue): value is Record<string, JsonValue> =>
	typeof value === "object" && value !== null;

const extractErrorCode = (body: JsonValue): string | null => {
	if (!isRecord(body)) {
		return null;
	}
	const candidate = (body as { readonly error?: JsonValue }).error;
	return typeof candidate === "string" ? candidate : null;
};

const readJson = (response: Response) =>
	response
		.json()
		.then((body) => body as JsonValue)
		.catch(() => null)
		.then((body) => ({ response, body }));

const toNetworkError = (error: Error | JsonValue | undefined): ApiError => {
	const reason =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: typeof error === "number"
					? String(error)
					: typeof error === "boolean"
						? String(error)
						: "unknown_error";
	return { _tag: "NetworkError", reason };
};

// CHANGE: Typed JSON fetcher that lifts HTTP failures into ApiError
// WHY: UI flows need explicit error channels for toast/inline rendering
// QUOTE(ТЗ): "Ошибки API — показывать в явном виде (toast + inline блок)."
// REF: REQ-INVITES-UI
// FORMAT THEOREM: ∀response: ok(response) → decode(body) ≠ null
// PURITY: SHELL
// EFFECT: Effect<T, ApiError, Http>
// INVARIANT: credentials include cookies for session-bound endpoints
// COMPLEXITY: O(1) per request
const fetchJson = <T>(
	input: RequestInfo | URL,
	init: RequestInit,
	decode: JsonDecoder<T>,
): Effect.Effect<T, ApiError> =>
	pipe(
		Effect.tryPromise(() =>
			fetch(input, { ...init, credentials: "include" }).then(readJson),
		),
		Effect.mapError((error) =>
			toNetworkError(error as Error | JsonValue | undefined),
		),
		Effect.flatMap(({ response, body }) => {
			if (!response.ok) {
				return Effect.fail<ApiError>({
					_tag: "ApiError",
					status: response.status,
					error: extractErrorCode(body) ?? "unknown_error",
					body,
				});
			}
			const parsed = decode(body);
			return parsed
				? Effect.succeed(parsed)
				: Effect.fail<ApiError>({
						_tag: "DecodeError",
						reason: "invalid_response_shape",
					});
		}),
	);

export const getJson = <T>(path: string, decode: JsonDecoder<T>) =>
	fetchJson(path, { method: "GET" }, decode);

export const postJson = <T>(
	path: string,
	body: JsonValue,
	decode: JsonDecoder<T>,
) =>
	fetchJson(
		path,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		decode,
	);
