import connectPg from "connect-pg-simple";
import { Effect, pipe } from "effect";
import session from "express-session";
import type { IncomingMessage } from "node:http";

export type SessionLookupOptions = {
  readonly cookieName?: string;
  readonly store?: session.Store;
  readonly conString?: string;
  readonly tableName?: string;
  readonly createTableIfMissing?: boolean;
};

type SessionWithUser = session.SessionData & {
  readonly userId?: string;
  readonly passport?: { readonly user?: { readonly id?: string } };
};

const parseCookies = (cookieHeader: string): Record<string, string> => {
  const entries = cookieHeader.split(";").flatMap((cookie) => {
    const [rawName, ...rest] = cookie.split("=");
    const name = rawName?.trim();
    const value = rest.join("=");
    if (!name || !value) {
      return [];
    }
    return [[name, decodeURIComponent(value.trim())] as const];
  });
  return Object.fromEntries(entries);
};

const extractSessionId = (rawCookie: string): string | null => {
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

const resolveStore = (options: SessionLookupOptions): session.Store => {
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

const readUserId = (sessionData: session.SessionData | null | undefined): string | null => {
  if (!sessionData) {
    return null;
  }
  const maybeDirect = (sessionData as SessionWithUser).userId;
  if (typeof maybeDirect === "string" && maybeDirect.length > 0) {
    return maybeDirect;
  }
  const passportId = (sessionData as SessionWithUser).passport?.user?.id;
  return typeof passportId === "string" && passportId.length > 0 ? passportId : null;
};

export const getSessionUserIdFromRequest = (
  request: IncomingMessage,
  options?: SessionLookupOptions,
): Effect.Effect<string | null> => {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return Effect.succeed<string | null>(null);
  }

  const cookies = parseCookies(cookieHeader);
  const cookieName = options?.cookieName ?? "connect.sid";
  const rawCookie = cookies[cookieName];
  if (!rawCookie) {
    return Effect.succeed<string | null>(null);
  }

  const sessionId = extractSessionId(rawCookie);
  if (!sessionId) {
    return Effect.succeed<string | null>(null);
  }

  const store = resolveStore(options ?? {});

  const lookup = Effect.async<string | null>((resume) => {
    store.get(sessionId, (error: Error | null, sessionData) => {
      if (error) {
        resume(Effect.succeed(null));
        return;
      }
      resume(Effect.succeed(readUserId(sessionData)));
    });
  });

  return pipe(lookup);
};
