# Fundsroom ERP API

This documentation reflects the currently implemented Fundsroom ERP API.

## Base URL and Authentication

The backend mounts the API under:

```text
http://localhost:3000
```

API routes use the `/api` prefix. Authentication uses a JWT returned by `POST /api/auth/login`:

```http
Authorization: Bearer <token>
```

Roles are read from the verified JWT by backend middleware. The frontend does not provide security enforcement.

## Response and Error Format

Successful responses use this envelope:

```json
{
  "success": true,
  "data": {}
}
```

Errors use this envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Common status codes:

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON or Zod request validation failure |
| `401` | Missing, invalid, or expired JWT; unauthenticated request |
| `403` | Authenticated user lacks the required role |
| `404` | Requested record or relationship does not exist |
| `409` | Duplicate record, invalid state transition, or business conflict |
| `422` | Valid request shape but invalid business value |
| `500` | Unexpected server error |

Unknown routes return `404 NOT_FOUND`. Database unique violations are returned as `409 CONFLICT` without exposing database details.

# Authentication

## POST `/api/auth/login`

Authenticates an active user and returns a JWT.

- Authentication: Public
- Required role: `PUBLIC`
- Request body:

```json
{
  "email": "sales@fundsroom.local",
  "password": "<development password>"
}
```

Validation:

- `email` must be a valid email address.
- `password` must be non-empty.
- Inactive users and invalid passwords are rejected.
- Passwords are verified against Argon2id hashes.

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "Neha Kapoor",
      "email": "sales@fundsroom.local",
      "role": "SALES",
      "isActive": true,
      "createdAt": "2026-09-27T00:00:00.000Z",
      "updatedAt": "2026-09-27T00:00:00.000Z"
    },
    "token": "<jwt>"
  }
}
```

Important errors:

- `401 INVALID_CREDENTIALS`
- `400 VALIDATION_ERROR`

## GET `/api/auth/me`

Returns the currently authenticated active user.

- Authentication: Bearer JWT required
- Required role: `BOTH` (`ADMIN` or `SALES`)
- Request body: None
- Parameters: None

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "Aarav Mehta",
      "email": "admin@fundsroom.local",
      "role": "ADMIN",
      "isActive": true
    }
  }
}
```

Important errors:

- `401 MISSING_TOKEN`
- `401 INVALID_TOKEN`
- `401 UNAUTHENTICATED`

# Customers / Enquiries

## POST `/api/customers`

Creates a customer. The server generates the customer code; clients do not submit arbitrary internal fields.

- Authentication: Bearer JWT required
- Required role: `SALES`
- Request body:

```json
{
  "companyName": "Acme Engineering Pvt. Ltd.",
  "contactPerson": "Rohan Shah",
  "mobile": "+91-98765-12001",
  "email": "rohan@example.com",
  "city": "Pune"
}
```

Validation:

- All five fields are required.
- Email must be valid.
- String lengths follow the database column limits.
- Unknown fields are rejected.

Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "uuid",
      "customerCode": "CUST-generated-code",
      "companyName": "Acme Engineering Pvt. Ltd.",
      "contactPerson": "Rohan Shah",
      "mobile": "+91-98765-12001",
      "email": "rohan@example.com",
      "city": "Pune",
      "createdAt": "2026-09-27T00:00:00.000Z",
      "updatedAt": "2026-09-27T00:00:00.000Z"
    }
  }
}
```

Important errors: `400 VALIDATION_ERROR`, `401`, and `409 CONFLICT`.

## GET `/api/customers`

Lists customers. An optional search string filters company name or customer code.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Query parameter: `search` optional string
- Request body: None

Success: `200 OK`, returning `data.customers`.

Important errors: `401`, `403`, and unexpected `500` errors.

## GET `/api/customers/:id`

Returns one customer.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Path parameter: `id` must be a UUID
- Request body: None

Success: `200 OK`, returning `data.customer`.

Important errors: `400 VALIDATION_ERROR`, `401`, `403`, and `404 CUSTOMER_NOT_FOUND`.

## POST `/api/enquiries`

Creates a customer enquiry with one or more product items.

- Authentication: Bearer JWT required
- Required role: `SALES`
- Request body:

```json
{
  "enquiryNumber": "ENQ-0001",
  "customerId": "uuid",
  "enquiryDate": "2026-09-27",
  "requiredDate": "2026-10-01",
  "items": [
    {
      "productId": "uuid",
      "quantity": 100
    },
    {
      "productId": "uuid",
      "quantity": 40
    }
  ],
  "notes": "Required for October production"
}
```

Validation and business rules:

- Dates must use `YYYY-MM-DD` and be real calendar dates.
- `requiredDate` cannot precede `enquiryDate`.
- At least one item is required.
- Every quantity must be greater than zero.
- The customer must exist.
- Every product must exist and be active.
- Duplicate products within an enquiry are rejected.
- The enquiry number is unique.
- New enquiries always start with status `NEW`.
- The header and items are created transactionally.

Success: `201 Created`, returning `data.enquiry` and `data.items`.

Important errors:

- `400 VALIDATION_ERROR`
- `401`, `403`
- `404 CUSTOMER_NOT_FOUND`
- `404 PRODUCT_NOT_FOUND`
- `409 DUPLICATE_ENQUIRY_NUMBER`
- `422 INVALID_REQUIRED_DATE`, `INVALID_QUANTITY`, or `DUPLICATE_PRODUCT`

## GET `/api/enquiries`

Lists enquiries with their item details.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Request body: None

Success: `200 OK`.

Each entry in `data.enquiries` has this shape:

```json
{
  "enquiry": {
    "id": "uuid",
    "enquiryNumber": "ENQ-0001",
    "customerId": "uuid",
    "enquiryDate": "2026-09-27",
    "requiredDate": "2026-10-01",
    "notes": "Required for October production",
    "status": "NEW"
  },
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productCode": "BRG-6205-2RS",
      "productName": "Deep Groove Ball Bearing 6205-2RS",
      "quantity": "100.00"
    }
  ]
}
```

Important errors: `401`, `403`, and unexpected `500` errors.

## GET `/api/enquiries/:id`

Returns one enquiry and its items.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Path parameter: `id` must be a UUID
- Request body: None

Success: `200 OK`, returning `data.enquiry` and `data.items`.

Important errors: `400 VALIDATION_ERROR`, `401`, `403`, and `404 ENQUIRY_NOT_FOUND`.

# Quotations

## POST `/api/quotations`

Creates a quotation from an existing enquiry.

- Authentication: Bearer JWT required
- Required role: `SALES`
- Request body:

```json
{
  "enquiryId": "uuid",
  "validUntil": "2026-10-31",
  "items": [
    {
      "productId": "uuid",
      "quantity": "10",
      "unitPrice": "500",
      "discountPercent": "10",
      "gstPercent": "18"
    }
  ]
}
```

Optional fields:

- `quotationNumber`: validated client-supplied number; otherwise generated server-side.
- `grandTotal`: accepted for compatibility but ignored as a source of truth. The backend calculates the total.

Validation and business rules:

- The enquiry must exist and have a customer.
- Every product must be active and belong to the enquiry.
- At least one item is required.
- Products cannot be duplicated within a quotation.
- Quantity must be greater than zero.
- Unit price must be non-negative.
- Discount and GST percentages must be between `0` and `100`.
- `validUntil` must be a real `YYYY-MM-DD` date.
- Quotation numbers are unique.
- The quotation starts in `DRAFT`.
- Quotation and quotation items are created transactionally.
- The server persists calculated subtotal, discount total, GST total, and grand total.

Calculation:

```text
baseAmount     = quantity * unitPrice
discountAmount = baseAmount * discountPercent / 100
taxableAmount  = baseAmount - discountAmount
gstAmount      = taxableAmount * gstPercent / 100
lineAmount     = taxableAmount + gstAmount
grandTotal     = sum(lineAmount)
```

Success: `201 Created`, returning `data.quotation` and `data.items`.

Important errors:

- `400 VALIDATION_ERROR`
- `401`, `403`
- `404 ENQUIRY_NOT_FOUND`, `CUSTOMER_NOT_FOUND`, or `PRODUCT_NOT_FOUND`
- `409 DUPLICATE_QUOTATION_NUMBER`
- `409 ENQUIRY_TERMINAL`
- `422 DUPLICATE_PRODUCT`, `INVALID_QUANTITY`, `INVALID_UNIT_PRICE`, `INVALID_DISCOUNT`, or `INVALID_GST`

## GET `/api/quotations`

Lists quotations with quotation, customer, enquiry, and item details.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Request body: None

Success: `200 OK`.

Each entry in `data.quotations` is returned as:

```json
{
  "quotation": {
    "id": "uuid",
    "quotationNumber": "QUO-001",
    "validUntil": "2026-10-31",
    "status": "DRAFT",
    "subtotal": "5000.00",
    "discountTotal": "500.00",
    "gstTotal": "810.00",
    "grandTotal": "5310.00"
  },
  "customer": {},
  "enquiry": {},
  "items": []
}
```

Important errors: `401`, `403`, and unexpected `500` errors.

## GET `/api/quotations/:id`

Returns one quotation with its customer, enquiry, and quotation items.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Path parameter: `id` must be a UUID
- Request body: None

Success: `200 OK`, returning `data.quotation`, `data.customer`, `data.enquiry`, and `data.items`.

Important errors: `400 VALIDATION_ERROR`, `401`, `403`, and `404 QUOTATION_NOT_FOUND`.

## PATCH `/api/quotations/:id/status`

Applies one controlled quotation status transition.

- Authentication: Bearer JWT required
- Required role: `SALES`
- Path parameter: `id` must be a UUID
- Request body:

```json
{
  "status": "SENT"
}
```

Allowed status values and transitions:

```text
DRAFT -> SENT
SENT  -> ACCEPTED
SENT  -> REJECTED
```

`ACCEPTED` and `REJECTED` are terminal for this workflow. Arbitrary status changes are not accepted. Accepting a quotation updates the related enquiry to `WON`; rejecting it updates the enquiry to `LOST`.

Success: `200 OK`, returning `data.quotation`.

Important errors:

- `400 VALIDATION_ERROR`
- `401`, `403`
- `404 QUOTATION_NOT_FOUND`
- `409 INVALID_STATUS_TRANSITION`

## POST `/api/quotations/:id/convert`

Converts an accepted quotation into one Sales Order.

- Authentication: Bearer JWT required
- Required role: `SALES`
- Path parameter: `id` must be a UUID
- Request body: None

Business rules:

- Only an `ACCEPTED` quotation can be converted.
- `DRAFT`, `SENT`, and `REJECTED` quotations are rejected.
- The quotation, enquiry, customer, and quotation items must exist.
- A quotation with no items cannot be converted.
- One quotation cannot generate duplicate Sales Orders. The database unique constraint on `sales_orders.quotation_id` is the final protection.
- Conversion runs transactionally.
- Quotation item pricing and calculated amounts are copied into Sales Order items.
- The new Sales Order starts in `PENDING`.

Success: `201 Created`, returning `data.order` and `data.items`.

Important errors:

- `401`, `403`
- `404 QUOTATION_NOT_FOUND`, `ENQUIRY_NOT_FOUND`, or `CUSTOMER_NOT_FOUND`
- `409 QUOTATION_NOT_ACCEPTED`
- `409 SALES_ORDER_ALREADY_EXISTS`
- `422 QUOTATION_HAS_NO_ITEMS`

# Sales Orders

## GET `/api/sales-orders`

Lists Sales Orders with customer, enquiry, quotation, and item details.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Request body: None

Success: `200 OK`. Each entry in `data.salesOrders` contains `order`, `customer`, `enquiry`, `quotation`, and `items`.

## GET `/api/sales-orders/:id`

Returns one Sales Order with its traceability relationships and item snapshots.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Path parameter: `id` must be a UUID
- Request body: None

Success: `200 OK`, returning `data.order`, `data.customer`, `data.enquiry`, `data.quotation`, and `data.items`.

Important errors: `400 VALIDATION_ERROR`, `401`, `403`, and `404 SALES_ORDER_NOT_FOUND`.

## POST `/api/sales-orders/:id/confirm`

Confirms a pending Sales Order and reserves inventory.

- Authentication: Bearer JWT required
- Required role: `ADMIN`
- Path parameter: `id` must be a UUID
- Request body: None

Business rules:

- The actual Sales Order status is read from PostgreSQL.
- Only `PENDING` orders can be confirmed.
- `CONFIRMED`, `DISPATCHED`, and `CANCELLED` orders are rejected.
- Physical inventory is not decreased.
- Reserved inventory increases by the order requirement.
- Available inventory is `physical - reserved`.
- Every required inventory row is locked in deterministic product order.
- All product checks and reservation updates are transactional.
- Reservation beyond available stock is rejected without partial reservation.

Success: `200 OK`, returning `data.order` and `data.reservations`.

Important errors:

- `401`, `403`
- `404 SALES_ORDER_NOT_FOUND` or `INVENTORY_NOT_FOUND`
- `409 SALES_ORDER_NOT_PENDING` or `INSUFFICIENT_INVENTORY`
- `422 SALES_ORDER_HAS_NO_ITEMS`

## POST `/api/sales-orders/:id/dispatch`

Dispatches a confirmed Sales Order.

- Authentication: Bearer JWT required
- Required role: `ADMIN`
- Path parameter: `id` must be a UUID
- Request body:

```json
{
  "vehicleNumber": "MH-12-AB-1234",
  "driverName": "Ravi Kumar"
}
```

Validation and business rules:

- Vehicle number and driver name are required and length-limited.
- Only `CONFIRMED` orders can be dispatched.
- `PENDING`, `DISPATCHED`, and `CANCELLED` orders are rejected.
- Reserved quantity must cover the dispatched quantity.
- Physical and reserved quantities both decrease by the dispatched quantity.
- Available quantity remains logically consistent because both values decrease equally.
- Dispatch and dispatch items are created transactionally with the inventory and status updates.
- The unique `dispatches.sales_order_id` constraint prevents duplicate dispatch records.

Success: `200 OK`, returning `data.dispatch`, `data.dispatchItems`, `data.order`, and `data.inventory`.

Important errors:

- `400 VALIDATION_ERROR`
- `401`, `403`
- `404 SALES_ORDER_NOT_FOUND` or `INVENTORY_NOT_FOUND`
- `409 SALES_ORDER_NOT_CONFIRMED`
- `409 DISPATCH_ALREADY_EXISTS`
- `409 INSUFFICIENT_RESERVED_INVENTORY`
- `409 INSUFFICIENT_PHYSICAL_INVENTORY`
- `422 SALES_ORDER_HAS_NO_ITEMS`

# Inventory

## GET `/api/inventory/availability`

Returns active product inventory availability.

- Authentication: Bearer JWT required
- Required role: `BOTH`
- Request body: None

Success: `200 OK`.

```json
{
  "success": true,
  "data": {
    "inventory": [
      {
        "product": {
          "id": "uuid",
          "productCode": "BRG-6205-2RS",
          "productName": "Deep Groove Ball Bearing 6205-2RS",
          "category": "Bearings",
          "unit": "Each",
          "basePrice": "485.00"
        },
        "physicalQuantity": "320.00",
        "reservedQuantity": "30.00",
        "availableQuantity": "290.00"
      }
    ]
  }
}
```

`availableQuantity` is calculated by the backend and is not an editable database field.

## PATCH `/api/inventory/:productId/adjust`

Receives or corrects physical inventory and records an audit entry.

- Authentication: Bearer JWT required
- Required role: `ADMIN`
- Path parameter: `productId` must be a UUID
- Request body:

```json
{
  "adjustmentType": "RECEIVE",
  "quantity": "50.00",
  "reason": "Goods received from supplier"
}
```

Adjustment types:

- `RECEIVE`: quantity must be positive and increases physical quantity.
- `CORRECTION`: quantity is a non-zero signed delta; a negative value reduces physical quantity.

Business rules:

- The inventory row is locked inside a transaction.
- Resulting physical quantity cannot be negative.
- Resulting physical quantity cannot be below reserved quantity.
- The inventory update and `inventory_adjustments` audit record commit or roll back together.
- Available quantity is recalculated as physical quantity minus reserved quantity.

Success: `200 OK`, returning `data.inventory` and `data.adjustment`.

Important errors:

- `400 VALIDATION_ERROR`
- `401 MISSING_TOKEN` or `UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 INVENTORY_NOT_FOUND`
- `422 INVALID_ADJUSTMENT_QUANTITY`
- `422 INVALID_RECEIPT_QUANTITY`
- `422 NEGATIVE_PHYSICAL_QUANTITY`
- `422 PHYSICAL_BELOW_RESERVED`

# Additional Implemented Endpoint

## GET `/health`

Returns backend process health.

- Authentication: Public
- Required role: `PUBLIC`
- Request body: None

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## GET `/api/admin/access`

A protected ADMIN authorization probe used by the backend test suite.

- Authentication: Bearer JWT required
- Required role: `ADMIN`
- Request body: None

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "authorized": true
  }
}
```

Important errors: `401 UNAUTHENTICATED`, `403 FORBIDDEN`.
