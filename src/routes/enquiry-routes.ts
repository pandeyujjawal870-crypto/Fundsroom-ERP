import { Router } from "express";
import { create, getById, list } from "../controllers/enquiry-controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const enquiryRouter = Router();
enquiryRouter.use(requireAuth, requireRole("ADMIN", "SALES"));
enquiryRouter.post("/", requireRole("SALES"), asyncHandler(create));
enquiryRouter.get("/", asyncHandler(list));
enquiryRouter.get("/:id", asyncHandler(getById));
