import jwt from "jsonwebtoken";
import request from "supertest";
import { expect, it, vi } from "vitest";

vi.mock("../src/repositories/user-repository.js", () => ({ findUserByEmail: vi.fn(), findUserById: vi.fn() }));
vi.mock("../src/services/sales-order-service.js", () => ({ convertAcceptedQuotation: vi.fn() }));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { convertAcceptedQuotation } from "../src/services/sales-order-service.js";

const app = createApp();
const quotationId = "11111111-1111-4111-8111-111111111111";
const token = (role: "ADMIN" | "SALES") => jwt.sign({ role }, env.JWT_SECRET, { subject: "22222222-2222-4222-8222-222222222222", expiresIn: "1h" });

it("allows SALES to convert an accepted quotation", async () => {
  vi.mocked(convertAcceptedQuotation).mockResolvedValue({ order: { status: "PENDING" }, items: [] } as never);
  const response = await request(app).post(`/api/quotations/${quotationId}/convert`).set("Authorization", `Bearer ${token("SALES")}`);
  expect(response.status).toBe(201);
  expect(response.body.data.order.status).toBe("PENDING");
});

it("rejects unauthenticated conversion", async () => {
  const response = await request(app).post(`/api/quotations/${quotationId}/convert`);
  expect(response.status).toBe(401);
});

it("rejects ADMIN conversion because SALES owns conversion", async () => {
  const response = await request(app).post(`/api/quotations/${quotationId}/convert`).set("Authorization", `Bearer ${token("ADMIN")}`);
  expect(response.status).toBe(403);
});
