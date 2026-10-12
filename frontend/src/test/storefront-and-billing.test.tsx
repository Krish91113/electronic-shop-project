import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { ShopChooser, ShopCatalogue } from "@/components/shop/public";
import { PrintableBillPage } from "@/routes/sales.$id.print";
import { AppShell } from "@/components/shop/shared";
import { publicApi, sales as salesApi, type PublicShop, type Sale, type Shop } from "@/lib/api";
import { STORE_NAME } from "@/lib/constants";
import * as authModule from "@/lib/auth";

// Mock API modules
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    publicApi: {
      ...actual.publicApi,
      listShops: vi.fn(),
      getShop: vi.fn(),
      listProducts: vi.fn(),
      getProduct: vi.fn(),
    },
    sales: {
      ...actual.sales,
      invoice: vi.fn(),
    },
  };
});

// Mock TanStack Router
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
      <a href={to ?? "#"} {...props}>
        {children}
      </a>
    ),
    useParams: () => ({ shopSlug: "shop-1", productSlug: "phone-1", id: "sale-123" }),
    useNavigate: () => vi.fn(),
    useRouterState: () => "/dashboard",
  };
});

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Public Storefront Routing", () => {
  it("matches all public and printable routes in router tree", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const homeMatch = router.matchRoutes("/");
    expect(homeMatch.at(-1)?.routeId).not.toBe(rootRouteId);

    const shopMatch = router.matchRoutes("/shop/time-centre-1");
    expect(shopMatch.at(-1)?.routeId).not.toBe(rootRouteId);

    const productMatch = router.matchRoutes("/shop/time-centre-1/products/samsung-s24");
    expect(productMatch.at(-1)?.routeId).not.toBe(rootRouteId);

    const printMatch = router.matchRoutes("/sales/sale-123/print");
    expect(printMatch.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("ShopChooser Landing Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Time Centre brand and dynamically lists available shops with live stock", async () => {
    const mockShops: PublicShop[] = [
      {
        name: "Time Centre - Shop 1",
        slug: "time-centre-shop-1",
        address: "123 Main Commercial Street",
        contactPhone: "+91 98765 43210",
        productCount: 45,
        inStockCount: 38,
      },
      {
        name: "Time Centre - Shop 2",
        slug: "time-centre-shop-2",
        address: "456 Market Road",
        contactPhone: "+91 98765 43211",
        productCount: 30,
        inStockCount: 25,
      },
    ];

    vi.mocked(publicApi.listShops).mockResolvedValue(mockShops);

    renderWithQuery(<ShopChooser />);

    // Brand and headline
    expect(screen.getAllByText(new RegExp(STORE_NAME, "i")).length).toBeGreaterThanOrEqual(1);

    // Verify shops appear after loading
    await waitFor(() => {
      expect(screen.getByText("Time Centre - Shop 1")).toBeDefined();
      expect(screen.getByText("Time Centre - Shop 2")).toBeDefined();
    });

    expect(screen.getByText("123 Main Commercial Street")).toBeDefined();
    expect(screen.getByText("456 Market Road")).toBeDefined();
    expect(screen.getByText(/38 products in stock/i)).toBeDefined();
    expect(screen.getByText(/25 products in stock/i)).toBeDefined();

    const browseButtons = screen.getAllByText(/browse this shop/i);
    expect(browseButtons).toHaveLength(2);
  });
});

describe("ShopCatalogue Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders specific shop details, in-stock default switch, and products", async () => {
    vi.mocked(publicApi.getShop).mockResolvedValue({
      name: "Time Centre - Shop 1",
      slug: "shop-1",
      address: "123 Main Commercial Street",
      contactPhone: "+91 98765 43210",
      productCount: 10,
      inStockCount: 8,
    });

    vi.mocked(publicApi.listShops).mockResolvedValue([
      {
        name: "Time Centre - Shop 1",
        slug: "shop-1",
        address: "123 Main Commercial Street",
        productCount: 10,
        inStockCount: 8,
      },
      {
        name: "Time Centre - Shop 2",
        slug: "shop-2",
        address: "456 Market Road",
        productCount: 5,
        inStockCount: 4,
      },
    ]);

    vi.mocked(publicApi.listProducts).mockResolvedValue({
      products: [
        {
          id: "prod-1",
          name: "OnePlus 12 5G",
          slug: "oneplus-12",
          brand: "OnePlus",
          model: "12",
          category: "Mobile Phones",
          defaultSellingPrice: 64999,
          warranty: "1 Year Official Warranty",
          isPublished: true,
          inStock: true,
          images: [],
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 24,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    renderWithQuery(<ShopCatalogue />);

    await waitFor(() => {
      expect(screen.getByText("Time Centre - Shop 1")).toBeDefined();
    });

    // Contact info
    expect(screen.getByText("123 Main Commercial Street")).toBeDefined();
    expect(screen.getByText("+91 98765 43210")).toBeDefined();

    // Switcher to other branch
    expect(screen.getByText(/switch to time centre - shop 2/i)).toBeDefined();

    // In stock only switch is present
    expect(screen.getByText(/in stock only/i)).toBeDefined();

    // Product card
    expect(screen.getByText("OnePlus 12 5G")).toBeDefined();
  });
});

describe("Printable Customer Bill Route (/sales/$id/print)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders clean customer bill with shop GSTIN, customer info, serial number, and warranty", async () => {
    const mockInvoice: Sale = {
      id: "sale-123",
      shopId: "shop-1",
      invoiceNumber: "TC1-2026-000001",
      status: "COMPLETED",
      subtotal: 50000,
      discountTotal: 2000,
      taxTotal: 8640,
      totalAmount: 56640,
      paymentStatus: "PAID",
      customerName: "Rahul Sharma",
      customerPhone: "+91 98765 99999",
      createdAt: "2026-10-12T10:30:00.000Z",
      items: [
        {
          id: "item-1",
          saleId: "sale-123",
          productId: "prod-1",
          productNameSnapshot: "Samsung Galaxy S24 Ultra",
          quantity: 1,
          unitSellingPrice: 50000,
          discountAmount: 2000,
          taxCategorySnapshot: "GST 18%",
          taxRateSnapshot: 18,
          taxAmount: 8640,
          serialNumber: "358923091823901",
          unitCostSnapshot: 42000,
          lineTotal: 56640,
          product: { warranty: "1 Year Comprehensive Brand Warranty" },
        },
      ],
      payments: [
        {
          id: "pay-1",
          shopId: "shop-1",
          saleId: "sale-123",
          method: "UPI",
          amount: 56640,
          status: "SUCCESS",
          createdAt: "2026-10-12T10:30:00.000Z",
        },
      ],
      shop: {
        name: "Time Centre - Shop 1",
        code: "TC1",
        address: "Shop 101, Central Electronic Market",
        contactPhone: "+91 98765 43210",
        gstin: "29AAAAA0000A1Z5",
        invoiceFooter: "Goods once sold can be serviced under warranty. Thank you!",
      },
    };

    vi.mocked(salesApi.invoice).mockResolvedValue(mockInvoice);

    renderWithQuery(<PrintableBillPage />);

    await waitFor(() => {
      expect(screen.getByText("Time Centre - Shop 1")).toBeDefined();
    });

    // GSTIN and Invoice
    expect(screen.getByText(/GSTIN: 29AAAAA0000A1Z5/i)).toBeDefined();
    expect(screen.getByText("TC1-2026-000001")).toBeDefined();

    // Customer details
    expect(screen.getByText("Rahul Sharma")).toBeDefined();
    expect(screen.getByText(/\+91 98765 99999/)).toBeDefined();

    // Item, IMEI/SN, and Warranty
    expect(screen.getByText("Samsung Galaxy S24 Ultra")).toBeDefined();
    expect(screen.getByText(/IMEI\/SN: 358923091823901/i)).toBeDefined();
    expect(screen.getByText(/Warranty: 1 Year Comprehensive Brand Warranty/i)).toBeDefined();

    // Tax breakdown and totals
    expect(screen.getByText("GST 18%:")).toBeDefined();
    expect(screen.getAllByText(/UPI/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Goods once sold can be serviced under warranty/i)).toBeDefined();

    // Verify layout options
    expect(screen.getByText(/A4 Standard/i)).toBeDefined();
    expect(screen.getByText(/80mm Thermal/i)).toBeDefined();

    // Does NOT contain Volt Electronics or "Save as PDF"
    expect(screen.queryByText(/Volt Electronics/i)).toBeNull();
    expect(screen.queryByText(/Save as PDF/i)).toBeNull();
  });

  it("renders CANCELLED banner for cancelled sales", async () => {
    const cancelledInvoice: Sale = {
      id: "sale-cancelled",
      shopId: "shop-1",
      invoiceNumber: "TC1-2026-000002",
      status: "CANCELLED",
      subtotal: 1000,
      discountTotal: 0,
      taxTotal: 180,
      totalAmount: 1180,
      paymentStatus: "REFUNDED",
      createdAt: "2026-10-12T10:30:00.000Z",
      items: [],
      payments: [],
      shop: {
        name: "Time Centre - Shop 1",
        code: "TC1",
      },
    };

    vi.mocked(salesApi.invoice).mockResolvedValue(cancelledInvoice);

    renderWithQuery(<PrintableBillPage />);

    await waitFor(() => {
      expect(screen.getByText(/CANCELLED SALE/i)).toBeDefined();
    });
  });
});

describe("Independent Shop TopBar Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides shop switcher and shows prominent shop name badge when user has only 1 shop", () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: {
        id: "u-1",
        email: "owner1@timecentre.com",
        role: "OWNER",
        shops: [{ id: "shop-1", name: "Time Centre - Shop 1", slug: "shop-1", code: "TC1" }],
      },
      activeShop: {
        id: "shop-1",
        name: "Time Centre - Shop 1",
        slug: "shop-1",
        code: "TC1",
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchShop: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <AppShell title="Dashboard">
        <div>Content</div>
      </AppShell>,
    );

    // Displays prominent shop badge in header
    expect(screen.getAllByText("Time Centre - Shop 1").length).toBeGreaterThanOrEqual(1);
    // Switcher dropdown should NOT be present
    expect(screen.queryByLabelText("Current shop")).toBeNull();
  });

  it("shows shop switcher when user has multiple shops (SUPER_OWNER)", () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: {
        id: "u-super",
        email: "superowner@timecentre.com",
        role: "SUPER_OWNER",
        shops: [
          { id: "shop-1", name: "Time Centre - Shop 1", slug: "shop-1", code: "TC1" },
          { id: "shop-2", name: "Time Centre - Shop 2", slug: "shop-2", code: "TC2" },
        ],
      },
      activeShop: {
        id: "shop-1",
        name: "Time Centre - Shop 1",
        slug: "shop-1",
        code: "TC1",
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchShop: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <AppShell title="Dashboard">
        <div>Content</div>
      </AppShell>,
    );

    // Switcher select exists
    expect(screen.getByLabelText("Current shop")).toBeDefined();
  });
});
