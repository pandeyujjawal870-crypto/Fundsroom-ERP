import jwt from "jsonwebtoken";
import request from "supertest";
import { expect, it, vi } from "vitest";

vi.mock("../src/repositories/user-repository.js", () => ({ findUserByEmail: vi.fn(), findUserById: vi.fn() }));
vi.mock("../src/services/quotation-service.js", () => ({ createQuotation: vi.fn(), changeQuotationStatus: vi.fn() }));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { createQuotation } from "../src/services/quotation-service.js";

const app = createApp();
const token = (role: "ADMIN" | "SALES") => jwt.sign({ role }, env.JWT_SECRET, { subject: "11111111-1111-4111-8111-111111111111", expiresIn: "1h" });

it("allows SALES to create a quotation", async () => {
  vi.mocked(createQuotation).mockResolvedValue({ quotation: { status: "DRAFT" }, items: [] } as never);
  const response = await request(app).post("/api/quotations").set("Authorization", `Bearer ${token("SALES")}`).send({
    enquiryId: "22222222-2222-4222-8222-222222222222",
    validUntil: "2026-10-31",
    items: [{ productId: "44444444-4444-4444-8444-444444444444", quantity: 1, unitPrice: 100, discountPercent: 0, gstPercent: 18 }],
  });
  expect(response.status).toBe(201);
  expect(response.body.data.quotation.status).toBe("DRAFT");
});

it("denies ADMIN quotation creation because SALES owns the workflow", async () => {
  const response = await request(app).post("/api/quotations").set("Authorization", `Bearer ${token("ADMIN")}`).send({});
  expect(response.status).toBe(403);
});

it("rejects unauthenticated quotation creation", async () => {
  const response = await request(app).post("/api/quotations").send({});
  expect(response.status).toBe(401);
});
