import type { users } from "../db/schema/index.js";

type UserRow = typeof users.$inferSelect;

export const toPublicUser = (user: UserRow) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
