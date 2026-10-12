// src/lib/api.ts
// Central typed API client for the Electronics Shop backend.

const rawBaseUrl = (import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:4000")
  .trim()
  .replace(/\/+$/, "");
const BASE_URL = rawBaseUrl.endsWith("/api/v1") ? rawBaseUrl.slice(0, -7) : rawBaseUrl;

// ─── Types ───────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiException extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Shop {
  id: string;
  name: string;
  code: string;
  slug: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  gstin?: string;
  invoicePrefix: string;
  invoiceFooter?: string;
  logoUrl?: string;
  timezone: string;
  pricingRule?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  shops: Pick<Shop, "id" | "name" | "slug" | "code">[];
  token?: string;
}

export interface TaxCategory {
  id: string;
  shopId: string;
  name: string;
  rate: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  publicId: string;
  url: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  barcode?: string;
  name: string;
  slug: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  purchaseCost: number;
  defaultSellingPrice?: number;
  pricingRule?: Record<string, unknown>;
  lowStockThreshold: number;
  warranty?: string;
  taxCategoryId?: string;
  taxCategory?: TaxCategory;
  isPublished: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
  inventory?: { quantity: number };
}

export interface InventoryItem {
  id: string;
  shopId: string;
  productId: string;
  quantity: number;
  updatedAt: string;
  product: Pick<
    Product,
    | "id"
    | "name"
    | "barcode"
    | "brand"
    | "lowStockThreshold"
    | "purchaseCost"
    | "defaultSellingPrice"
    | "images"
  >;
}

export interface StockMovement {
  id: string;
  shopId: string;
  productId: string;
  movementType: string;
  quantityDelta: number;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  product?: Pick<Product, "id" | "name" | "barcode">;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productNameSnapshot: string;
  barcodeSnapshot?: string;
  quantity: number;
  unitSellingPrice: number;
  discountAmount: number;
  taxCategorySnapshot?: string;
  taxRateSnapshot: number;
  taxAmount: number;
  serialNumber?: string;
  unitCostSnapshot: number;
  lineTotal: number;
  product?: { warranty?: string };
}

export interface Sale {
  id: string;
  shopId: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  paymentStatus: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
  items: SaleItem[];
  payments: Payment[];
  shop?: Pick<
    Shop,
    | "name"
    | "code"
    | "contactPhone"
    | "contactEmail"
    | "address"
    | "gstin"
    | "logoUrl"
    | "invoiceFooter"
  >;
}

export interface Payment {
  id: string;
  shopId: string;
  saleId: string;
  method: string;
  amount: number;
  status: string;
  reference?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  shopId: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  period: { from: string; to: string };
  completedSales: number;
  netSales: number;
  grossProfit: number;
  lowStockCount: number;
  recentSales: Sale[];
}

export interface ProfitLossReport {
  period: { from: string; to: string; timezone?: string };
  salesCount: number;
  netSales: number;
  discounts: number;
  taxCollected: number;
  refunds: number;
  refundCount: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  note: string;
}

// ─── Core Fetcher ─────────────────────────────────────────────────

let activeShopId: string | null = null;

export function setActiveShop(shopId: string | null) {
  activeShopId = shopId;
}

export function getActiveShopId(): string | null {
  return activeShopId;
}

// Registered by the auth layer so a 401 anywhere can clear the session.
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

const TOKEN_KEY = "time_centre_auth_token";
function getStoredToken(): string | null {
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.getItem === "function"
    ) {
      return window.localStorage.getItem(TOKEN_KEY);
    }
  } catch {
    // fallback
  }
  return null;
}
let authToken: string | null = getStoredToken();

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.setItem === "function"
    ) {
      if (token) {
        window.localStorage.setItem(TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {
    // fallback
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

interface RawResponse {
  data?: unknown;
  pagination?: Pagination;
  error?: ApiError;
}

async function rawRequest(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<RawResponse> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(activeShopId ? { "x-shop-id": activeShopId } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...extraHeaders,
  };

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
    signal: AbortSignal.timeout(30_000),
  };
  if (body !== undefined) {
    init.body = isFormData ? (body as FormData) : JSON.stringify(body);
  }

  let res: Response;
  try {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    res = await fetch(`${BASE_URL}/api/v1${cleanPath}`, init);
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === "TimeoutError"
        ? "The request timed out. Please try again."
        : "Unable to reach the server. Check your connection.";
    throw new ApiException(0, { code: "NETWORK_ERROR", message });
  }

  const json = (await res.json().catch(() => ({}))) as RawResponse;

  if (!res.ok) {
    const err = json.error ?? { code: "UNKNOWN", message: `Request failed (${res.status})` };
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    throw new ApiException(res.status, err);
  }

  return json;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const json = await rawRequest(method, path, body, extraHeaders);
  return json.data as T;
}

/** For paginated list endpoints: controller returns { data: [], pagination: {} } */
async function requestList<T>(
  method: string,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<{ data: T[]; pagination: Pagination }> {
  const json = await rawRequest(method, path, undefined, extraHeaders);
  return {
    data: (json.data as T[]) ?? [],
    pagination: json.pagination ?? {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

async function upload(path: string, formData: FormData): Promise<unknown> {
  const json = await rawRequest("POST", path, formData);
  return json.data;
}

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ─── Auth ─────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    request<User>("POST", "/auth/login", { email, password }),
  me: () => request<User>("GET", "/auth/me"),
  logout: () => request<{ message: string }>("POST", "/auth/logout"),
};

// ─── Shops ────────────────────────────────────────────────────────

export type ShopUpdate = {
  [
    K in
      | "name"
      | "contactPhone"
      | "contactEmail"
      | "address"
      | "gstin"
      | "invoicePrefix"
      | "invoiceFooter"
      | "logoUrl"
  ]?: string | undefined;
};

export const shops = {
  list: () => request<Shop[]>("GET", "/shops"),
  get: (id: string) => request<Shop>("GET", `/shops/${id}`),
  getCurrent: () => request<Shop>("GET", "/shops/current"),
  updateCurrent: (data: ShopUpdate) => request<Shop>("PATCH", "/shops/current", data),
  update: (id: string, data: ShopUpdate) => request<Shop>("PATCH", `/shops/${id}`, data),
};

// ─── Tax Categories ───────────────────────────────────────────────

export const taxCategories = {
  list: () => request<TaxCategory[]>("GET", "/tax-categories"),
  create: (data: { name: string; rate: number; isDefault?: boolean }) =>
    request<TaxCategory>("POST", "/tax-categories", data),
  update: (id: string, data: Partial<{ name: string; rate: number; isDefault: boolean }>) =>
    request<TaxCategory>("PATCH", `/tax-categories/${id}`, data),
  delete: (id: string) => request<{ deleted: boolean }>("DELETE", `/tax-categories/${id}`),
};

// ─── Products ─────────────────────────────────────────────────────

export interface ListProductsParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  brand?: string | undefined;
  isActive?: boolean | undefined;
}

export interface CreateProductData {
  name: string;
  barcode?: string | null | undefined;
  brand?: string | null | undefined;
  model?: string | null | undefined;
  category?: string | null | undefined;
  description?: string | null | undefined;
  purchaseCost: number;
  defaultSellingPrice?: number | null | undefined;
  lowStockThreshold?: number | undefined;
  warranty?: string | null | undefined;
  taxCategoryId?: string | null | undefined;
  isPublished?: boolean | undefined;
  initialStock?: number | undefined;
}

export type UpdateProductData = Partial<CreateProductData & { isActive: boolean }>;

export const products = {
  list: async (params: ListProductsParams = {}) => {
    const { data, pagination } = await requestList<Product>("GET", "/products" + qs(params));
    return { products: data, pagination };
  },
  get: (id: string) => request<Product>("GET", `/products/${id}`),
  scan: (barcode: string) => request<Product>("POST", "/products/scan", { barcode }),
  create: (data: CreateProductData) => request<Product>("POST", "/products", data),
  update: (id: string, data: UpdateProductData) =>
    request<Product>("PATCH", `/products/${id}`, data),
  delete: (id: string) =>
    request<{ id: string; deleted: boolean; archived?: boolean; message?: string }>(
      "DELETE",
      `/products/${id}`,
    ),
};

// ─── Inventory ────────────────────────────────────────────────────

export const inventory = {
  list: async (params: { page?: number; limit?: number } = {}) => {
    const { data, pagination } = await requestList<InventoryItem>("GET", "/inventory" + qs(params));
    return { items: data, pagination };
  },
  lowStock: async (params: { page?: number; limit?: number } = {}) => {
    const { data, pagination } = await requestList<InventoryItem>(
      "GET",
      "/inventory/low-stock" + qs(params),
    );
    return { items: data, pagination };
  },
  movements: async (params: { page?: number; limit?: number; productId?: string } = {}) => {
    const { data, pagination } = await requestList<StockMovement>(
      "GET",
      "/inventory/movements" + qs(params),
    );
    return { movements: data, pagination };
  },
  receive: (data: {
    productId: string;
    quantity: number;
    unitCost: number;
    notes?: string | undefined;
  }) =>
    request<{
      movement: StockMovement;
      inventory: { productId: string; quantity: number; weightedAvgCost: number };
    }>("POST", "/inventory/receive", data),
  adjust: (data: {
    productId: string;
    quantityDelta: number;
    movementType: string;
    notes?: string | undefined;
  }) =>
    request<{ movement: StockMovement; inventory: { productId: string; quantity: number } }>(
      "POST",
      "/inventory/adjust",
      data,
    ),
};

// ─── Sales ────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  quantity: number;
  unitSellingPrice: number;
  discountAmount?: number | undefined;
  serialNumber?: string | undefined;
}

export interface CreateSaleData {
  items: CartItem[];
  paymentMethod: string;
  paymentReference?: string | undefined;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  notes?: string | undefined;
}

export const sales = {
  list: async (
    params: { page?: number; limit?: number; from?: string; to?: string; status?: string } = {},
  ) => {
    const { data, pagination } = await requestList<Sale>("GET", "/sales" + qs(params));
    return { sales: data, pagination };
  },
  get: (id: string) => request<Sale>("GET", `/sales/${id}`),
  invoice: (id: string) => request<Sale>("GET", `/sales/${id}/invoice`),
  create: (data: CreateSaleData, idempotencyKey?: string) =>
    request<Sale>(
      "POST",
      "/sales",
      data,
      idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    ),
  cancel: (id: string) => request<Sale>("POST", `/sales/${id}/cancel`, {}),
};

// ─── Expenses ─────────────────────────────────────────────────────

export interface CreateExpenseData {
  category: string;
  amount: number;
  date?: string;
  description?: string;
}

export const expenses = {
  list: async (
    params: { page?: number; limit?: number; category?: string; from?: string; to?: string } = {},
  ) => {
    const { data, pagination } = await requestList<Expense>("GET", "/expenses" + qs(params));
    return { expenses: data, pagination };
  },
  get: (id: string) => request<Expense>("GET", `/expenses/${id}`),
  create: (data: CreateExpenseData) => request<Expense>("POST", "/expenses", data),
  update: (id: string, data: Partial<CreateExpenseData>) =>
    request<Expense>("PATCH", `/expenses/${id}`, data),
  delete: (id: string) => request<{ deleted: boolean }>("DELETE", `/expenses/${id}`),
};

// ─── Dashboard ────────────────────────────────────────────────────

export const dashboard = {
  get: (params: { from?: string; to?: string } = {}) =>
    request<DashboardData>("GET", "/dashboard" + qs(params)),
};

// ─── Reports ──────────────────────────────────────────────────────

export const reports = {
  profitLoss: (params: { from: string; to: string; timezone?: string }) =>
    request<ProfitLossReport>("GET", "/reports/profit-loss" + qs(params)),
};

// ─── Images ───────────────────────────────────────────────────────

export const images = {
  upload: (productId: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return upload(`/images/upload/${productId}`, fd) as Promise<ProductImage>;
  },
  setPrimary: (imageId: string) => request<ProductImage>("PATCH", `/images/${imageId}/primary`),
  delete: (imageId: string) => request<{ deleted: boolean }>("DELETE", `/images/${imageId}`),
};

// ─── Public ───────────────────────────────────────────────────────

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  defaultSellingPrice?: number;
  warranty?: string;
  isPublished: boolean;
  inStock: boolean;
  images: ProductImage[];
}

export interface PublicShop {
  name: string;
  slug: string;
  address?: string;
  contactPhone?: string;
  logoUrl?: string;
  productCount: number;
  inStockCount: number;
}

export const publicApi = {
  listShops: async (): Promise<PublicShop[]> => {
    const res = await request<{ data: PublicShop[] } | PublicShop[]>("GET", "/public/shops");
    return Array.isArray(res) ? res : ((res as { data: PublicShop[] }).data ?? []);
  },
  getShop: (slug: string) => request<PublicShop>("GET", `/public/shops/${slug}`),
  listProducts: async (
    shopSlug: string,
    params: {
      search?: string | undefined;
      category?: string | undefined;
      inStock?: boolean | string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    } = {},
  ) => {
    const { data, pagination } = await requestList<PublicProduct>(
      "GET",
      `/public/shops/${shopSlug}/products` + qs(params),
    );
    return { products: data, pagination };
  },
  getProduct: (shopSlug: string, productSlug: string) =>
    request<PublicProduct>("GET", `/public/shops/${shopSlug}/products/${productSlug}`),
};

// ─── Error helpers ────────────────────────────────────────────────

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiException) {
    if (err.details && Array.isArray(err.details) && err.details.length > 0) {
      const messages = err.details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d: any) => {
          const path =
            Array.isArray(d?.path) && d.path.length > 0 ? `${d.path[d.path.length - 1]}: ` : "";
          return `${path}${d?.message || "Invalid value"}`;
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(", ");
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiException && err.status === 401;
}
