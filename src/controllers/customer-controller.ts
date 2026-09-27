import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import { createCustomerSchema, customerIdSchema } from "../schemas/customer-schemas.js";
import { createCustomer, findCustomerById, listCustomers } from "../repositories/customer-repository.js";
import { randomUUID } from "node:crypto";

const toPublicCustomer = (customer: NonNullable<Awaited<ReturnType<typeof createCustomer>>>) => ({
  id: customer.id,
  customerCode: customer.customerCode,
  companyName: customer.companyName,
  contactPerson: customer.contactPerson,
  mobile: customer.mobile,
  email: customer.email,
  city: customer.city,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

export const create = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const input = createCustomerSchema.parse(request.body);
  const customer = await createCustomer({ ...input, customerCode: `CUST-${randomUUID()}`, createdBy: request.user.id });
  response.status(201).json({ success: true, data: { customer: toPublicCustomer(customer) } });
};

export const list = async (request: Request, response: Response) => {
  const search = typeof request.query.search === "string" ? request.query.search : undefined;
  response.json({ success: true, data: { customers: (await listCustomers(search)).map(toPublicCustomer) } });
};

export const getById = async (request: Request, response: Response) => {
  const id = customerIdSchema.parse(request.params.id);
  const customer = await findCustomerById(id);
  if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.json({ success: true, data: { customer: toPublicCustomer(customer) } });
};
