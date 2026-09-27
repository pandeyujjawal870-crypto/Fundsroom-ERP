import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./client";
import { quotationApi, salesOrderApi } from "./resources";

it("normalizes the backend quotation envelope for list rendering", async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    quotations: [{
      quotation: {
        id: "quotation-1",
        quotationNumber: "QUO-001",
        validUntil: "2026-10-01",
        status: "DRAFT",
        subtotal: "100.00",
        discountTotal: "0.00",
        gstTotal: "18.00",
        grandTotal: "118.00",
        createdAt: "2026-09-27",
        updatedAt: "2026-09-27",
      },
      customer: null,
      enquiry: null,
      items: [],
    }],
  } as never);

  const result = await quotationApi.list();
  expect(result.quotations[0]).toMatchObject({ id: "quotation-1", quotationNumber: "QUO-001", status: "DRAFT", items: [] });
});

it("normalizes the backend Sales Order envelope for list rendering", async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    salesOrders: [{
      order: {
        id: "order-1",
        salesOrderNumber: "SO-001",
        quotationId: "quotation-1",
        enquiryId: "enquiry-1",
        customerId: "customer-1",
        orderDate: "2026-09-27",
        totalAmount: "5310.00",
        status: "PENDING",
        createdAt: "2026-09-27",
        updatedAt: "2026-09-27",
      },
      customer: null,
      enquiry: null,
      quotation: null,
      items: [],
    }],
  } as never);

  const result = await salesOrderApi.list();
  expect(result.salesOrders[0]).toMatchObject({ id: "order-1", totalAmount: "5310.00", status: "PENDING", items: [] });
});
