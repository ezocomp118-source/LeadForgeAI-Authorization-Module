import { Effect } from "effect";
import session from "express-session";
import type { IncomingMessage } from "node:http";
export type SessionLookupOptions = {
    readonly cookieName?: string;
    readonly store?: session.Store;
    readonly conString?: string;
    readonly tableName?: string;
    readonly createTableIfMissing?: boolean;
};
/**
 * CHANGE: Extract userId from session cookie for WebSocket upgrade or raw HTTP
 * WHY: Allow host apps to reuse Authorization Module session parsing without duplicating code
 * QUOTE(ТЗ): "получить userId из HTTP cookie сессии ... без копирования кода"
 * REF: AUTH-WS-SESSION
 * PURITY: SHELL
 * EFFECT: Effect<Promise<string | null>, never, never>
 * INVARIANT: Returns null on missing/invalid cookie or store lookup errors
 * COMPLEXITY: O(1) lookup plus store I/O
 */
export declare const getSessionUserIdFromRequest: (request: IncomingMessage, options?: SessionLookupOptions) => ReturnType<typeof Effect.runPromise>;
