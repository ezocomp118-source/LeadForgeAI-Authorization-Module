import connectPg from "connect-pg-simple";
import { Effect, pipe } from "effect";
import session from "express-session";
const parseCookies = (cookieHeader) => {
    const entries = cookieHeader.split(";").flatMap((cookie) => {
        const [rawName, ...rest] = cookie.split("=");
        const name = rawName?.trim();
        const value = rest.join("=");
        if (!name || !value) {
            return [];
        }
        return [[name, decodeURIComponent(value.trim())]];
    });
    return Object.fromEntries(entries);
};
const extractSessionId = (rawCookie) => {
    if (!rawCookie) {
        return null;
    }
    if (rawCookie.startsWith("s:")) {
        const unsigned = rawCookie.slice(2);
        const parts = unsigned.split(".");
        return parts[0]?.length ? parts[0] : null;
    }
    return rawCookie;
};
const resolveStore = (options) => {
    if (options.store) {
        return options.store;
    }
    if (options.conString) {
        const PgStore = connectPg(session);
        return new PgStore({
            conString: options.conString,
            tableName: options.tableName ?? "app_sessions",
            createTableIfMissing: options.createTableIfMissing ?? true,
        });
    }
    return new session.MemoryStore();
};
const readUserId = (sessionData) => {
    if (!sessionData) {
        return null;
    }
    const maybeDirect = sessionData.userId;
    if (typeof maybeDirect === "string" && maybeDirect.length > 0) {
        return maybeDirect;
    }
    const passportId = sessionData.passport?.user?.id;
    return typeof passportId === "string" && passportId.length > 0 ? passportId : null;
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
export const getSessionUserIdFromRequest = (request, options) => {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
        return Effect.runPromise(Effect.succeed(null));
    }
    const cookies = parseCookies(cookieHeader);
    const cookieName = options?.cookieName ?? "connect.sid";
    const rawCookie = cookies[cookieName];
    if (!rawCookie) {
        return Effect.runPromise(Effect.succeed(null));
    }
    const sessionId = extractSessionId(rawCookie);
    if (!sessionId) {
        return Effect.runPromise(Effect.succeed(null));
    }
    const store = resolveStore(options ?? {});
    const lookup = Effect.async((resume) => {
        store.get(sessionId, (error, sessionData) => {
            if (error) {
                resume(Effect.succeed(null));
                return;
            }
            resume(Effect.succeed(readUserId(sessionData)));
        });
    });
    return Effect.runPromise(pipe(lookup));
};
