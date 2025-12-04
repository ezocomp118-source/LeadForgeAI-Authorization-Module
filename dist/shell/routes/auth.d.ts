import type { NextFunction, Request, RequestHandler, Response } from "express";
export declare const isAuthenticated: (req: Request, res: Response, next: NextFunction) => void;
export declare const postLogin: RequestHandler;
export declare const postLogout: RequestHandler;
export declare const getMe: RequestHandler;
