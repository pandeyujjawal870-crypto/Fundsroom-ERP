import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../errors/api-error.js";

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "The requested endpoint does not exist."));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.flatten() } });
    return;
  }
  if (error?.code === "23505") {
    response.status(409).json({ success: false, error: { code: "CONFLICT", message: "A record with the same unique value already exists.", details: {} } });
    return;
  }
  const apiError = error instanceof ApiError ? error : new ApiError(500, "INTERNAL_SERVER_ERROR", "An unexpected server error occurred.");
  response.status(apiError.statusCode).json({ success: false, error: { code: apiError.code, message: apiError.message, details: apiError.details } });
};
