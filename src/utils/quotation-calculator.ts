import DecimalModule from "decimal.js";
import { ApiError } from "../errors/api-error.js";

type DecimalValue = {
  add(value: DecimalValue | string | number): DecimalValue;
  sub(value: DecimalValue | string | number): DecimalValue;
  mul(value: DecimalValue | string | number): DecimalValue;
  div(value: DecimalValue | string | number): DecimalValue;
  lte(value: DecimalValue | string | number): boolean;
  lt(value: DecimalValue | string | number): boolean;
  gt(value: DecimalValue | string | number): boolean;
  isFinite(): boolean;
  toDecimalPlaces(decimalPlaces: number, rounding: number): DecimalValue;
  toFixed(decimalPlaces: number): string;
};

type DecimalConstructor = {
  new (value: string | number): DecimalValue;
  set(config: { precision: number; rounding: number }): void;
  ROUND_HALF_UP: number;
};

const Decimal = DecimalModule as unknown as DecimalConstructor;

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type QuotationItemInput = {
  productId: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  gstPercent: string;
};

export type CalculatedQuotationItem = QuotationItemInput & {
  baseAmount: string;
  discountAmount: string;
  gstAmount: string;
  lineAmount: string;
};

// PostgreSQL numeric money fields use two-decimal, half-up rounding at each persisted amount.
const money = (value: DecimalValue) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

const decimal = (value: string, field: string) => {
  try {
    const parsed = new Decimal(value);
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new ApiError(422, "INVALID_AMOUNT", `${field} must be a valid decimal value.`);
  }
};

export const calculateQuotation = (items: QuotationItemInput[]) => {
  const calculatedItems: CalculatedQuotationItem[] = items.map((item) => {
    const quantity = decimal(item.quantity, "Quantity");
    const unitPrice = decimal(item.unitPrice, "Unit price");
    const discountPercent = decimal(item.discountPercent, "Discount percentage");
    const gstPercent = decimal(item.gstPercent, "GST percentage");

    if (quantity.lte(0)) throw new ApiError(422, "INVALID_QUANTITY", "Quantity must be greater than zero.");
    if (unitPrice.lt(0)) throw new ApiError(422, "INVALID_UNIT_PRICE", "Unit price cannot be negative.");
    if (discountPercent.lt(0) || discountPercent.gt(100)) throw new ApiError(422, "INVALID_DISCOUNT", "Discount percentage must be between 0 and 100.");
    if (gstPercent.lt(0) || gstPercent.gt(100)) throw new ApiError(422, "INVALID_GST", "GST percentage must be between 0 and 100.");

    const baseAmount = quantity.mul(unitPrice);
    const discountAmount = baseAmount.mul(discountPercent).div(100);
    const taxableAmount = baseAmount.sub(discountAmount);
    const gstAmount = taxableAmount.mul(gstPercent).div(100);
    const lineAmount = taxableAmount.add(gstAmount);

    return {
      ...item,
      baseAmount: money(baseAmount),
      discountAmount: money(discountAmount),
      gstAmount: money(gstAmount),
      lineAmount: money(lineAmount),
    };
  });

  const subtotal = calculatedItems.reduce((total, item) => total.add(item.baseAmount), new Decimal(0));
  const discountTotal = calculatedItems.reduce((total, item) => total.add(item.discountAmount), new Decimal(0));
  const gstTotal = calculatedItems.reduce((total, item) => total.add(item.gstAmount), new Decimal(0));
  const grandTotal = calculatedItems.reduce((total, item) => total.add(item.lineAmount), new Decimal(0));

  return {
    items: calculatedItems,
    subtotal: money(subtotal),
    discountTotal: money(discountTotal),
    gstTotal: money(gstTotal),
    grandTotal: money(grandTotal),
  };
};
