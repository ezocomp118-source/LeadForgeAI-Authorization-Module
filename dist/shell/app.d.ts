import { type Express } from "express";
import session from "express-session";
export type SessionMiddlewareConfig = {
    readonly secret?: string;
    readonly store?: session.Store;
    readonly cookie?: Partial<session.CookieOptions>;
};
/**
 * CHANGE: Exportable session middleware with host-provided store/secret support
 * WHY: Allow host Express apps to reuse a single session store/cookie without duplication
 * QUOTE(ТЗ): "applySession должен принимать опциональный конфиг (secret, cookie opts, store)"
 * REF: AUTH-SESSION-EMBED
 * PURITY: SHELL
 * EFFECT: Effect<Express, never, never>
 * INVARIANT: session middleware is attached exactly once per Express instance
 * COMPLEXITY: O(1)
 */
export declare const applySession: (app: Express, config?: SessionMiddlewareConfig) => void;
/**
 * CHANGE: Exportable API router installer
 * WHY: Allow host Express apps to mount module REST endpoints on an existing server
 * QUOTE(ТЗ): "mountApiRoutes(app: Express): void — подключение REST-роутов"
 * REF: AUTH-ROUTES-EMBED
 * PURITY: SHELL
 * EFFECT: Effect<Express, never, never>
 * INVARIANT: Routes are registered under /api/* with attached auth guards
 * COMPLEXITY: O(1) registration
 */
export declare const mountApiRoutes: (app: Express) => void;
export declare const createApp: () => Express;
