import express, { type Express, type Request, type Response } from "express";
import session from "express-session";
import { join } from "node:path";
import swaggerUi from "swagger-ui-express";

import { computeHealth } from "../core/health.js";
import { loadManifest, lookupEntryAssets, renderHtmlShell } from "./frontend-manifest.js";
import { getMe, isAuthenticated, postLogin, postLogout } from "./routes/auth.js";
import { getInvitations, postInvitation, requireAdmin, revokeInvitation } from "./routes/invitations.js";
import { postRegister } from "./routes/registration.js";
import {
  confirmEmailVerification,
  confirmPhoneVerification,
  requestEmailVerification,
  requestPhoneVerification,
} from "./routes/verification.js";
import { swaggerDocument } from "./swagger.js";

const applySession = (app: Express): void => {
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
};

const mountStatic = (
  app: Express,
  staticRoot: string,
): void => {
  const manifest = loadManifest(staticRoot);
  const sendHtml = (entryKey: string, title: string) => (_req: Request, res: Response): void => {
    const assets = lookupEntryAssets(manifest, entryKey);
    if (!assets) {
      res
        .status(503)
        .send("Frontend assets not found. Run `npm run build` before serving.");
      return;
    }
    res.type("html").send(renderHtmlShell(assets, title));
  };

  app.use("/auth-admin", express.static(staticRoot));
  app.use("/register", express.static(staticRoot));
  app.use("/assets", express.static(join(staticRoot, "assets")));
  app.get(
    "/auth-admin",
    sendHtml("react-admin/src/auth-admin.tsx", "Authorization Admin · Invitations"),
  );
  app.get(
    "/auth-admin/*",
    sendHtml("react-admin/src/auth-admin.tsx", "Authorization Admin · Invitations"),
  );
  app.get(
    "/register",
    sendHtml("react-admin/src/register.tsx", "Register with invitation"),
  );
  app.get(
    "/register/*",
    sendHtml("react-admin/src/register.tsx", "Register with invitation"),
  );
};

const mountApiRoutes = (app: Express): void => {
  app.get("/api/invitations", isAuthenticated, requireAdmin, getInvitations);
  app.post("/api/invitations", isAuthenticated, requireAdmin, postInvitation);
  app.post(
    "/api/invitations/:id/revoke",
    isAuthenticated,
    requireAdmin,
    revokeInvitation,
  );
  app.post("/api/register", postRegister);
  app.post("/api/auth/register", postRegister);
  app.post("/api/auth/login", postLogin);
  app.post("/api/auth/logout", postLogout);
  app.get("/api/auth/me", isAuthenticated, getMe);
  app.post(
    "/api/auth/email/verify/request",
    isAuthenticated,
    requestEmailVerification,
  );
  app.post("/api/auth/email/verify/confirm", confirmEmailVerification);
  app.post(
    "/api/auth/phone/verify/request",
    isAuthenticated,
    requestPhoneVerification,
  );
  app.post(
    "/api/auth/phone/verify/confirm",
    isAuthenticated,
    confirmPhoneVerification,
  );
};

export const createApp = (): Express => {
  const app = express();
  const staticRoot = join(process.cwd(), "dist");

  app.use(express.json());
  applySession(app);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  mountStatic(app, staticRoot);

  app.get("/health", (_req: Request, res: Response): void => {
    const payload = computeHealth(Date.now());
    res.status(200).json(payload);
  });

  mountApiRoutes(app);

  return app;
};
