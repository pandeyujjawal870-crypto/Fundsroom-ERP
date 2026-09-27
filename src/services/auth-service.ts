import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../errors/api-error.js";
import { findUserByEmail, findUserById } from "../repositories/user-repository.js";
import { toPublicUser } from "../utils/public-user.js";
import type { UserRole } from "../middleware/auth.js";

type TokenPayload = { id: string; role: UserRole };

export const authenticate = async (email: string, password: string) => {
  const user = await findUserByEmail(email.toLowerCase());
  if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, password))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  return { user: toPublicUser(user), token };
};

export const getAuthenticatedUser = async (id: string) => {
  const user = await findUserById(id);
  if (!user || !user.isActive) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  return toPublicUser(user);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || !payload.sub || (payload.role !== "ADMIN" && payload.role !== "SALES")) {
    throw new ApiError(401, "INVALID_TOKEN", "The access token is invalid.");
  }
  return { id: payload.sub, role: payload.role };
};
