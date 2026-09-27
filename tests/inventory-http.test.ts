import jwt from "jsonwebtoken";
import request from "supertest";
import { expect, it, vi } from "vitest";

vi.mock("../src/repositories/user-repository.js", () => ({ findUserByEmail: vi.fn(), findUserById: vi.fn() }));
vi.mock("../src/services/inventory-service.js", () => ({ confirmSalesOrder: vi.fn() }));
vi.mock("../src/services/inventory-adjustment-service.js", () => ({ adjustInventory: vi.fn() }));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { confirmSalesOrder } from "../src/services/inventory-service.js";
import { adjustInventory } from "../src/services/inventory-adjustment-service.js";

const app = createApp();
const orderId = "11111111-1111-4111-8111-111111111111";
const token = (role: "ADMIN" | "SALES") => jwt.sign({ role }, env.JWT_SECRET, { subject: "22222222-2222-4222-8222-222222222222", expiresIn: "1h" });

it("allows ADMIN to confirm a Sales Order", async () => {
  vi.mocked(confirmSalesOrder).mockResolvedValue({ order: { status: "CONFIRMED" }, reservations: [] } as never);
  const response = await request(app).post(`/api/sales-orders/${orderId}/confirm`).set("Authorization", `Bearer ${token("ADMIN")}`);
  expect(response.status).toBe(200);
  expect(response.body.data.order.status).toBe("CONFIRMED");
});

it("rejects SALES confirmation", async () => {
  const response = await request(app).post(`/api/sales-orders/${orderId}/confirm`).set("Authorization", `Bearer ${token("SALES")}`);
  expect(response.status).toBe(403);
});

it("rejects unauthenticated confirmation", async () => {
  const response = await request(app).post(`/api/sales-orders/${orderId}/confirm`);
  expect(response.status).toBe(401);
});

it("allows ADMIN to adjust inventory", async () => {
  vi.mocked(adjustInventory).mockResolvedValue({ inventory: { availableQuantity: "120.00" }, adjustment: {} } as never);
  const response = await request(app).patch(`/api/inventory/${orderId}/adjust`).set("Authorization", `Bearer ${token("ADMIN")}`).send({ adjustmentType: "RECEIVE", quantity: "20", reason: "Goods received" });
  expect(response.status).toBe(200);
});

it("rejects SALES inventory adjustment", async () => {
  const response = await request(app).patch(`/api/inventory/${orderId}/adjust`).set("Authorization", `Bearer ${token("SALES")}`).send({ adjustmentType: "RECEIVE", quantity: "20", reason: "Goods received" });
  expect(response.status).toBe(403);
});

it("rejects unauthenticated inventory adjustment", async () => {
  const response = await request(app).patch(`/api/inventory/${orderId}/adjust`).send({ adjustmentType: "RECEIVE", quantity: "20", reason: "Goods received" });
  expect(response.status).toBe(401);
});
