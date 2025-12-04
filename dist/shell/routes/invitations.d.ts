import type { RequestHandler } from "express";
import { type InvitationError, type InvitationQuery, type InvitationsResponse } from "./invitations-helpers.js";
export declare const requireAdmin: RequestHandler;
export declare const getInvitations: RequestHandler<Record<string, string>, InvitationsResponse | InvitationError, undefined, InvitationQuery>;
export declare const postInvitation: RequestHandler;
export declare const revokeInvitation: RequestHandler;
