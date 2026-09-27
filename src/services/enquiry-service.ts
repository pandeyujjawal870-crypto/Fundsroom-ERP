import { ApiError } from "../errors/api-error.js";
import { db } from "../db/index.js";
import { findCustomerById } from "../repositories/customer-repository.js";
import { findEnquiryByNumber, findExistingProducts, insertEnquiry, insertEnquiryItems } from "../repositories/enquiry-repository.js";

type CreateEnquiryInput = {
  enquiryNumber: string;
  customerId: string;
  enquiryDate: string;
  requiredDate: string;
  notes?: string | null;
  items: { productId: string; quantity: number }[];
};

export const createEnquiry = async (input: CreateEnquiryInput, createdBy: string) => {
  if (input.requiredDate < input.enquiryDate) {
    throw new ApiError(422, "INVALID_REQUIRED_DATE", "Required date cannot be earlier than enquiry date.");
  }
  if (input.items.some((item) => item.quantity <= 0)) {
    throw new ApiError(422, "INVALID_QUANTITY", "Every enquiry item quantity must be greater than zero.");
  }
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    throw new ApiError(422, "DUPLICATE_PRODUCT", "An enquiry cannot contain the same product more than once.");
  }

  const [customer, existingEnquiry, activeProducts] = await Promise.all([
    findCustomerById(input.customerId),
    findEnquiryByNumber(input.enquiryNumber),
    findExistingProducts(input.items.map((item) => item.productId)),
  ]);
  if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  if (existingEnquiry) throw new ApiError(409, "DUPLICATE_ENQUIRY_NUMBER", "Enquiry number already exists.");

  const activeProductIds = new Set(activeProducts.filter((product) => product.isActive).map((product) => product.id));
  const missingProductId = input.items.find((item) => !activeProductIds.has(item.productId))?.productId;
  if (missingProductId) throw new ApiError(404, "PRODUCT_NOT_FOUND", `Product ${missingProductId} not found or inactive.`);

  return db.transaction(async (transaction) => {
    const enquiry = await insertEnquiry(transaction, {
      enquiryNumber: input.enquiryNumber,
      customerId: input.customerId,
      enquiryDate: input.enquiryDate,
      requiredDate: input.requiredDate,
      notes: input.notes ?? null,
      status: "NEW",
      createdBy,
    });
    if (!enquiry) throw new ApiError(500, "ENQUIRY_CREATE_FAILED", "The enquiry could not be created.");
    const items = await insertEnquiryItems(
      transaction,
      input.items.map((item) => ({ enquiryId: enquiry.id, productId: item.productId, quantity: String(item.quantity) })),
    );
    return { enquiry, items };
  });
};
