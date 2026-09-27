import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import { findEnquiryById, listEnquiries, listEnquiryItems } from "../repositories/enquiry-repository.js";
import { createEnquirySchema, enquiryIdSchema } from "../schemas/enquiry-schemas.js";
import { createEnquiry } from "../services/enquiry-service.js";

export const create = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const input = createEnquirySchema.parse(request.body);
  const result = await createEnquiry(input, request.user.id);
  response.status(201).json({ success: true, data: result });
};

export const list = async (_request: Request, response: Response) => {
  const enquiries = await listEnquiries();
  const data = await Promise.all(enquiries.map(async (enquiry) => ({ enquiry, items: await listEnquiryItems(enquiry.id) })));
  response.json({ success: true, data: { enquiries: data } });
};

export const getById = async (request: Request, response: Response) => {
  const id = enquiryIdSchema.parse(request.params.id);
  const enquiry = await findEnquiryById(id);
  if (!enquiry) throw new ApiError(404, "ENQUIRY_NOT_FOUND", "Enquiry not found.");
  response.json({ success: true, data: { enquiry, items: await listEnquiryItems(id) } });
};
