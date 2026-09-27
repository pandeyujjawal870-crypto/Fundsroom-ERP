import type { Request, Response } from "express";
import { loginSchema } from "../schemas/auth-schemas.js";
import { authenticate, getAuthenticatedUser } from "../services/auth-service.js";
import { ApiError } from "../errors/api-error.js";

export const login = async (request: Request, response: Response) => {
  const input = loginSchema.parse(request.body);
  response.json({ success: true, data: await authenticate(input.email, input.password) });
};

export const me = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  response.json({ success: true, data: { user: await getAuthenticatedUser(request.user.id) } });
};
