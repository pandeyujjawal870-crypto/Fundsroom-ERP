import jwt from "jsonwebtoken";
import request from "supertest";
import { expect, it, vi } from "vitest";

vi.mock("../src/repositories/user-repository.js", () => ({ findUserByEmail: vi.fn(), findUserById: vi.fn() }));
vi.mock("../src/services/dispatch-service.js", () => ({ dispatchSalesOrder: vi.fn() }));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { dispatchSalesOrder } from "../src/services/dispatch-service.js";

const app = createApp();
const orderId = "11111111-1111-4111-8111-111111111111";
const token = (role: "ADMIN" | "SALES") => jwt.sign({ role }, env.JWT_SECRET, { subject: "22222222-2222-4222-8222-222222222222", expiresIn: "1h" });
const body = { vehicleNumber: "MH-12-AB-1234", driverName: "Ravi Kumar" };

it("allows ADMIN to dispatch a confirmed Sales Order", async () => {
  vi.mocked(dispatchSalesOrder).mockResolvedValue({ order: { status: "DISPATCHED" }, dispatch: {}, dispatchItems: [] } as never);
  const response = await request(app).post(`/api/sales-orders/${orderId}/dispatch`).set("Authorization", `Bearer ${token("ADMIN")}`).send(body);
  expect(response.status).toBe(200);
  expect(response.body.data.order.status).toBe("DISPATCHED");
});

it("rejects SALES dispatch", async () => {
  const response = await request(app).post(`/api/sales-orders/${orderId}/dispatch`).set("Authorization", `Bearer ${token("SALES")}`).send(body);
  expect(response.status).toBe(403);
});

it("rejects unauthenticated dispatch", async () => {
  const response = await request(app).post(`/api/sales-orders/${orderId}/dispatch`).send(body);
  expect(response.status).toBe(401);
});
