import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/repositories/user-repository.js", () => ({ findUserByEmail: vi.fn(), findUserById: vi.fn() }));
vi.mock("../src/repositories/customer-repository.js", () => ({
  createCustomer: vi.fn(),
  findCustomerById: vi.fn(),
  listCustomers: vi.fn(),
}));
vi.mock("../src/services/enquiry-service.js", () => ({ createEnquiry: vi.fn() }));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { createCustomer } from "../src/repositories/customer-repository.js";
import { createEnquiry } from "../src/services/enquiry-service.js";

const app = createApp();
const salesId = "11111111-1111-4111-8111-111111111111";
const token = (role: "ADMIN" | "SALES") => jwt.sign({ role }, env.JWT_SECRET, { subject: salesId, expiresIn: "1h" });
const customer = {
  id: "22222222-2222-4222-8222-222222222222",
  customerCode: "CUST-generated",
  companyName: "ABC Engineering Pvt. Ltd.",
  contactPerson: "Rohan Shah",
  mobile: "+91-98765-12001",
  email: "rohan@example.com",
  city: "Pune",
  createdBy: salesId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

it("allows an authenticated SALES user to create a customer", async () => {
  vi.mocked(createCustomer).mockResolvedValue(customer);
  const response = await request(app).post("/api/customers").set("Authorization", `Bearer ${token("SALES")}`).send({
    companyName: customer.companyName,
    contactPerson: customer.contactPerson,
    mobile: customer.mobile,
    email: customer.email,
    city: customer.city,
  });
  expect(response.status).toBe(201);
  expect(response.body.data.customer).not.toHaveProperty("createdBy");
  expect(response.body.data.customer.companyName).toBe(customer.companyName);
});

it("rejects unauthenticated customer creation", async () => {
  const response = await request(app).post("/api/customers").send({ companyName: "ABC" });
  expect(response.status).toBe(401);
});

it("allows SALES to create an enquiry with multiple products", async () => {
  vi.mocked(createEnquiry).mockResolvedValue({
    enquiry: { id: "33333333-3333-4333-8333-333333333333", status: "NEW" },
    items: [{ productId: "44444444-4444-4444-8444-444444444444", quantity: "100" }, { productId: "55555555-5555-4555-8555-555555555555", quantity: "40" }],
  } as never);
  const response = await request(app).post("/api/enquiries").set("Authorization", `Bearer ${token("SALES")}`).send({
    enquiryNumber: "ENQ-0001",
    customerId: customer.id,
    enquiryDate: "2026-09-27",
    requiredDate: "2026-10-01",
    items: [
      { productId: "44444444-4444-4444-8444-444444444444", quantity: 100 },
      { productId: "55555555-5555-4555-8555-555555555555", quantity: 40 },
    ],
    notes: "Multiple products",
  });
  expect(response.status).toBe(201);
  expect(response.body.data.enquiry.status).toBe("NEW");
  expect(response.body.data.items).toHaveLength(2);
});

it("rejects ADMIN from SALES-only customer and enquiry creation", async () => {
  const customerResponse = await request(app).post("/api/customers").set("Authorization", `Bearer ${token("ADMIN")}`).send({});
  const enquiryResponse = await request(app).post("/api/enquiries").set("Authorization", `Bearer ${token("ADMIN")}`).send({});
  expect(customerResponse.status).toBe(403);
  expect(enquiryResponse.status).toBe(403);
});
