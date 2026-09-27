import argon2 from "argon2";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/repositories/user-repository.js", () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { findUserByEmail } from "../src/repositories/user-repository.js";

const app = createApp();
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Neha Kapoor",
  email: "sales@fundsroom.local",
  passwordHash: "",
  role: "SALES" as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const tokenFor = (role: "ADMIN" | "SALES") => jwt.sign({ role }, env.JWT_SECRET, { subject: user.id, expiresIn: "1h" });

beforeAll(async () => {
  user.passwordHash = await argon2.hash("correct-password", { type: argon2.argon2id });
});

describe("authentication", () => {
  it("logs in with valid credentials", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(user);
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password: "correct-password" });
    expect(response.status).toBe(200);
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it("rejects an invalid password", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(user);
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects inactive users", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue({ ...user, isActive: false });
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password: "correct-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects missing and invalid JWTs", async () => {
    const missing = await request(app).get("/api/auth/me");
    const invalid = await request(app).get("/api/auth/me").set("Authorization", "Bearer invalid-token");
    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it("rejects expired JWTs", async () => {
    const expired = jwt.sign({ role: "SALES" }, env.JWT_SECRET, { subject: user.id, expiresIn: "-1s" });
    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(response.status).toBe(401);
  });
});

describe("RBAC and validation", () => {
  it("forbids SALES from ADMIN-only operations", async () => {
    const response = await request(app).get("/api/admin/access").set("Authorization", `Bearer ${tokenFor("SALES")}`);
    expect(response.status).toBe(403);
  });

  it("allows ADMIN operations", async () => {
    const response = await request(app).get("/api/admin/access").set("Authorization", `Bearer ${tokenFor("ADMIN")}`);
    expect(response.status).toBe(200);
    expect(response.body.data.authorized).toBe(true);
  });

  it("rejects invalid customer input", async () => {
    const response = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${tokenFor("SALES")}`)
      .send({ companyName: "Missing required fields" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
