import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import { verifyAccessToken } from "../services/auth-service.js";

export type UserRole = "ADMIN" | "SALES";
export type AuthenticatedUser = { id: string; role: UserRole };

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = (request: Request, _response: Response, next: NextFunction) => {
  const header = request.get("authorization");
  if (!header?.startsWith("Bearer ")) return next(new ApiError(401, "MISSING_TOKEN", "Authentication is required."));
  try {
    request.user = verifyAccessToken(header.slice(7).trim());
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, "INVALID_TOKEN", "The access token is invalid or expired."));
  }
};

export const requireRole = (...roles: UserRole[]) => (request: Request, _response: Response, next: NextFunction) => {
  if (!request.user) return next(new ApiError(401, "UNAUTHENTICATED", "Authentication is required."));
  if (!roles.includes(request.user.role)) return next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action."));
  next();
};
