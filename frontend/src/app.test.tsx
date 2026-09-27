import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "./api/client";
import { authApi, customerApi, enquiryApi, inventoryApi, quotationApi, salesOrderApi } from "./api/resources";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { Login } from "./pages/Login";
import { Enquiries } from "./pages/Enquiries";
import { Quotations } from "./pages/Quotations";
import { SalesOrders } from "./pages/SalesOrders";
import { Inventory } from "./pages/Inventory";
import { StatusBadge } from "./components/ui";

vi.mock("./api/resources", () => ({
  authApi: { login: vi.fn(), me: vi.fn() },
  customerApi: { list: vi.fn(), create: vi.fn() },
  enquiryApi: { list: vi.fn(), create: vi.fn() },
  inventoryApi: { list: vi.fn() },
  quotationApi: { list: vi.fn(), create: vi.fn(), updateStatus: vi.fn(), convert: vi.fn() },
  salesOrderApi: { list: vi.fn(), confirm: vi.fn(), dispatch: vi.fn() },
}));

const user = { id: "user-1", fullName: "Admin User", email: "admin@example.com", role: "ADMIN" as const, isActive: true };
const customer = { id: "customer-1", customerCode: "CUST-1", companyName: "Acme Engineering", contactPerson: "Ravi Shah", mobile: "123", email: "ravi@example.com", city: "Pune" };
const product = { id: "product-1", productCode: "P-1", productName: "Industrial Bearing", category: "Bearings", unit: "Each", basePrice: "500.00" };
const inventory = { product, physicalQuantity: "100.00", reservedQuantity: "20.00", availableQuantity: "80.00" };

const renderWithAuth = (element: React.ReactNode, role: "ADMIN" | "SALES" = "SALES") => {
  localStorage.setItem("fundsroom_access_token", "test-token");
  localStorage.setItem("fundsroom_user", JSON.stringify({ ...user, role }));
  vi.mocked(authApi.me).mockResolvedValue({ user: { ...user, role } });
  return render(<MemoryRouter><AuthProvider>{element}</AuthProvider></MemoryRouter>);
};

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(authApi.me).mockResolvedValue({ user });
  vi.mocked(customerApi.list).mockResolvedValue({ customers: [customer] });
  vi.mocked(enquiryApi.list).mockResolvedValue({ enquiries: [] });
  vi.mocked(inventoryApi.list).mockResolvedValue({ inventory: [inventory] });
  vi.mocked(quotationApi.list).mockResolvedValue({ quotations: [] });
  vi.mocked(salesOrderApi.list).mockResolvedValue({ salesOrders: [] });
});

afterEach(() => cleanup());

describe("frontend authentication and routing", () => {
  it("renders the login form", () => {
    render(<MemoryRouter><AuthProvider><Login /></AuthProvider></MemoryRouter>);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows login errors", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password."));
    render(<MemoryRouter><AuthProvider><Login /></AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "bad@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });

  it("redirects unauthenticated users from protected routes", async () => {
    render(<MemoryRouter initialEntries={["/enquiries"]}><AuthProvider><Routes><Route element={<ProtectedRoute />}><Route path="/enquiries" element={<div>Private content</div>} /></Route><Route path="/login" element={<div>Login destination</div>} /></Routes></AuthProvider></MemoryRouter>);
    expect(await screen.findByText("Login destination")).toBeInTheDocument();
  });
});

describe("workflow screens", () => {
  it("renders a fallback badge when status is missing", () => {
    render(<StatusBadge status={undefined} />);
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });

  it("renders the enquiries page and loading state", async () => {
    let resolve!: (value: { enquiries: never[] }) => void;
    vi.mocked(enquiryApi.list).mockReturnValue(new Promise((next) => { resolve = next; }));
    renderWithAuth(<Enquiries />);
    expect(screen.getByText("Loading enquiries...")).toBeInTheDocument();
    resolve({ enquiries: [] });
    expect(await screen.findByText("No enquiries found.")).toBeInTheDocument();
  });

  it("hides enquiry creation from ADMIN users", async () => {
    renderWithAuth(<Enquiries />, "ADMIN");
    expect(await screen.findByRole("heading", { name: "Enquiries" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new enquiry/i })).not.toBeInTheDocument();
  });

  it("renders the quotations page", async () => {
    renderWithAuth(<Quotations />);
    expect(await screen.findByRole("heading", { name: "Quotations" })).toBeInTheDocument();
    expect(screen.getByText("No quotations found.")).toBeInTheDocument();
  });

  it("renders the Sales Orders page", async () => {
    renderWithAuth(<SalesOrders />);
    expect(await screen.findByRole("heading", { name: "Sales Orders" })).toBeInTheDocument();
    expect(screen.getByText("No Sales Orders found.")).toBeInTheDocument();
  });

  it("renders the inventory availability page", async () => {
    renderWithAuth(<Inventory />);
    expect(await screen.findByRole("heading", { name: "Inventory" })).toBeInTheDocument();
    expect(screen.getByText("Industrial Bearing")).toBeInTheDocument();
  });

  it("shows stock adjustment only to ADMIN", async () => {
    renderWithAuth(<Inventory />, "ADMIN");
    expect(await screen.findByRole("button", { name: /adjust stock/i })).toBeInTheDocument();
  });

  it("shows an API error state", async () => {
    vi.mocked(enquiryApi.list).mockRejectedValue(new Error("Network unavailable"));
    renderWithAuth(<Enquiries />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load enquiries.");
  });

  it("shows ADMIN confirm and dispatch actions", async () => {
    vi.mocked(salesOrderApi.list).mockResolvedValue({ salesOrders: [
      { id: "pending", salesOrderNumber: "SO-1", status: "PENDING", items: [], totalAmount: "100", customer: customer, quotation: null, enquiry: null, quotationId: "q", enquiryId: "e", customerId: customer.id, orderDate: "2026-01-01" },
      { id: "confirmed", salesOrderNumber: "SO-2", status: "CONFIRMED", items: [], totalAmount: "100", customer: customer, quotation: null, enquiry: null, quotationId: "q", enquiryId: "e", customerId: customer.id, orderDate: "2026-01-01" },
    ] as never });
    renderWithAuth(<SalesOrders />, "ADMIN");
    expect(await screen.findByRole("button", { name: "Confirm order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dispatch order" })).toBeInTheDocument();
  });

  it("renders the backend Sales Order total and status", async () => {
    vi.mocked(salesOrderApi.list).mockResolvedValue({ salesOrders: [{ id: "order-1", salesOrderNumber: "SO-1", status: "PENDING", items: [], totalAmount: "5310.00", customer, quotation: null, enquiry: null, quotationId: "q", enquiryId: "e", customerId: customer.id, orderDate: "2026-01-01" }] as never });
    renderWithAuth(<SalesOrders />, "ADMIN");
    expect(await screen.findByText("₹5,310.00")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("does not show ADMIN actions to SALES", async () => {
    vi.mocked(salesOrderApi.list).mockResolvedValue({ salesOrders: [{ id: "pending", salesOrderNumber: "SO-1", status: "PENDING", items: [], totalAmount: "100", customer, quotation: null, enquiry: null, quotationId: "q", enquiryId: "e", customerId: customer.id, orderDate: "2026-01-01" }] as never });
    renderWithAuth(<SalesOrders />, "SALES");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm order" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Dispatch order" })).not.toBeInTheDocument();
  });
});
