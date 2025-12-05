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
export declare const getSessionUserIdFromRequest: (request: IncomingMessage, options?: SessionLookupOptions) => Effect.Effect<string | null>;
