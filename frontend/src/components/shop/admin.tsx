import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  Package,
  TrendingUp,
  Wallet,
  TriangleAlert,
  Plus,
  ArrowUpRight,
  ScanLine,
  Pencil,
  Power,
  Boxes,
  Upload,
  CheckCircle2,
  Printer,
  Download,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowDownToLine,
  Store,
  Trash2,
  Camera,
  AlertTriangle,
  X,
  Hash,
} from "lucide-react";
import { BarcodeScanner } from "./barcode-scanner";
import { StockUnitsManager } from "./stock-units-manager";
import { ImeiBulkInput } from "./imei-bulk-input";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AppShell, PageHeader, MetricCard, SearchInput, EmptyState, Field, Brand } from "./shared";
import { useAuth } from "@/lib/auth";
import {
  products as productsApi,
  inventory as inventoryApi,
  stockUnits as stockUnitsApi,
  taxCategories as taxCategoriesApi,
  images as imagesApi,
  sales as salesApi,
  dashboard as dashboardApi,
  reports as reportsApi,
  shops as shopsApi,
  getErrorMessage,
  type Product as ApiProduct,
  type StockUnit,
  type InventoryItem,
  type StockMovement,
  type Sale,
  type ProfitLossReport,
} from "@/lib/api";

type Product = ApiProduct;

// ─── Shared helpers ───────────────────────────────────────────────

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">{message}</div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw size={14} /> Retry
        </Button>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t text-sm text-muted-foreground">
      <Button
        variant="ghost"
        size="icon"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button
        variant="ghost"
        size="icon"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}

/** Inline status badge for API products (using isActive + optional stock quantity) */
function ApiStatusBadge({
  isActive,
  qty,
  threshold,
}: {
  isActive: boolean;
  qty?: number | undefined;
  threshold?: number | undefined;
}) {
  let label: string;
  let cls: string;
  if (!isActive) {
    label = "Inactive";
    cls = "status status-neutral";
  } else if (qty === 0) {
    label = "Out of stock";
    cls = "status status-danger";
  } else if (qty !== undefined && threshold !== undefined && qty <= threshold) {
    label = "Low stock";
    cls = "status status-warning";
  } else {
    label = "In stock";
    cls = "status status-success";
  }
  return (
    <span className={cls}>
      <span />
      {label}
    </span>
  );
}

function ProductThumb({ product }: { product: ApiProduct }) {
  const img = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  return (
    <div className="table-product">
      {img ? (
        <img
          src={img.url}
          alt={product.name}
          width={40}
          height={40}
          className="rounded object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
          <Package size={18} className="text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <h3 className="truncate font-medium">{product.name}</h3>
        <div className="flex items-center gap-1.5 flex-wrap text-muted-foreground text-xs mt-0.5">
          <span>{[product.brand, product.model].filter(Boolean).join(" · ") || "—"}</span>
          {product.variant && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              {product.variant}
            </span>
          )}
          {product.color && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              {product.color}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProductsPage ─────────────────────────────────────────────────

export function ProductsPage() {
  useAuth(); // ensure shop context is active
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["products", debouncedSearch, isActiveFilter, page],
    queryFn: () =>
      productsApi.list({ search: debouncedSearch || undefined, isActive: isActiveFilter, page }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsApi.update(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product status updated.");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [deleteProductItem, setDeleteProductItem] = useState<ApiProduct | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleteProductItem(null);
      if (data?.archived) {
        toast.info(data.message || "Product archived because of historical sales.");
      } else {
        toast.success("Product deleted successfully.");
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const filterLabel =
    isActiveFilter === true ? "Active" : isActiveFilter === false ? "Inactive" : "All";

  return (
    <AppShell title="Products">
      <PageHeader title="Products" subtitle="Your full product catalogue.">
        <Button asChild>
          <Link to="/products/new">
            <Plus />
            Add Product
          </Link>
        </Button>
      </PageHeader>

      <section className="panel">
        <div className="table-toolbar">
          <div className="flex gap-2 flex-1 items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or barcode…"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScannerOpen(true)}
              title="Scan barcode to search"
              className="h-10 px-3 shrink-0"
            >
              <Camera size={16} className="mr-1" />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
          <div className="filter-chips">
            {(["All", "Active", "Inactive"] as const).map((label) => (
              <button
                key={label}
                className={`filter-chip ${filterLabel === label ? "filter-chip-active" : ""}`}
                onClick={() => {
                  setIsActiveFilter(
                    label === "All" ? undefined : label === "Active" ? true : false,
                  );
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : isError ? (
          <div className="p-4">
            <ErrorAlert message={getErrorMessage(error)} onRetry={() => refetch()} />
          </div>
        ) : !data?.products.length ? (
          <EmptyState
            title="No products found"
            detail="Try a different search or add a new product."
          />
        ) : (
          <>
            <div className="table-scroll desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Purchase cost</th>
                    <th>Selling price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => {
                    const stockQty = p.trackSerial
                      ? (p.inStockCount ?? p.inventory?.quantity ?? 0)
                      : (p.inventory?.quantity ?? 0);
                    const isExpanded = expandedProductId === p.id;
                    const priceDisplay =
                      p.minPrice != null && p.maxPrice != null && p.minPrice !== p.maxPrice
                        ? `${fmt(p.minPrice)} – ${fmt(p.maxPrice)}`
                        : p.defaultSellingPrice != null
                        ? fmt(p.defaultSellingPrice)
                        : "—";

                    return (
                      <Fragment key={p.id}>
                        <tr>
                          <td>
                            <ProductThumb product={p} />
                          </td>
                          <td>
                            {p.trackSerial ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                  <Boxes size={11} /> IMEI Tracked
                                </span>
                                {p.barcode && (
                                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                    {p.barcode}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="mono">{p.barcode ?? "—"}</span>
                            )}
                          </td>
                          <td>{fmt(p.purchaseCost)}</td>
                          <td className="font-medium">{priceDisplay}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span>{stockQty} units</span>
                              {p.trackSerial && (p.stockUnits?.length ?? 0) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setExpandedProductId(isExpanded ? null : p.id)
                                  }
                                >
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  <span className="text-[10px] ml-0.5">
                                    {p.stockUnits?.length} IMEIs
                                  </span>
                                </Button>
                              )}
                            </div>
                          </td>
                          <td>
                            <ApiStatusBadge
                              isActive={p.isActive}
                              qty={stockQty}
                              threshold={p.lowStockThreshold}
                            />
                          </td>
                          <td>
                            <div className="table-actions">
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${p.name}`}
                                title="Edit product"
                              >
                                <Link to="/products/$id/edit" params={{ id: p.id }}>
                                  <Pencil size={15} />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
                                title={p.isActive ? "Deactivate product" : "Activate product"}
                                disabled={toggleMutation.isPending}
                                onClick={() =>
                                  toggleMutation.mutate({ id: p.id, isActive: !p.isActive })
                                }
                              >
                                <Power size={15} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${p.name}`}
                                title="Delete product"
                                className="text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteProductItem(p)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && p.trackSerial && (
                          <tr className="bg-muted/20">
                            <td colSpan={7} className="p-3">
                              <div className="rounded-md border bg-background p-3 text-xs space-y-2">
                                <div className="flex justify-between items-center font-semibold text-muted-foreground">
                                  <span>In-Stock IMEIs for {p.name} ({p.stockUnits?.length ?? 0})</span>
                                  <Link
                                    to="/products/$id/edit"
                                    params={{ id: p.id }}
                                    className="text-emerald-600 hover:underline flex items-center gap-1 font-medium"
                                  >
                                    Manage Units &amp; Serial Numbers <ArrowUpRight size={12} />
                                  </Link>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {p.stockUnits?.map((u) => (
                                    <div
                                      key={u.id}
                                      className="p-2 rounded border bg-muted/40 font-mono text-[11px] flex justify-between items-center"
                                    >
                                      <div>
                                        <div className="font-semibold text-foreground">{u.imei1}</div>
                                        {u.imei2 && (
                                          <div className="text-muted-foreground text-[10px]">
                                            {u.imei2}
                                          </div>
                                        )}
                                      </div>
                                      <span className="font-sans text-muted-foreground font-medium">
                                        {u.sellingPrice ? fmt(u.sellingPrice) : "Default"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-records">
              {data.products.map((p) => (
                <div className="mobile-record" key={p.id}>
                  <div className="mobile-record-top">
                    <ProductThumb product={p} />
                    <div className="table-actions">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${p.name}`}
                        title="Edit product"
                      >
                        <Link to="/products/$id/edit" params={{ id: p.id }}>
                          <Pencil size={15} />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${p.isActive ? "Deactivate" : "Activate"} ${p.name}`}
                        title={p.isActive ? "Deactivate product" : "Activate product"}
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate({ id: p.id, isActive: !p.isActive })}
                      >
                        <Power size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${p.name}`}
                        title="Delete product"
                        className="text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteProductItem(p)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                  <div className="mobile-record-meta">
                    <span>
                      {p.inventory != null ? `${p.inventory.quantity} units` : "—"} ·{" "}
                      {p.defaultSellingPrice != null ? fmt(p.defaultSellingPrice) : "—"}
                    </span>
                    <ApiStatusBadge
                      isActive={p.isActive}
                      qty={p.inventory?.quantity}
                      threshold={p.lowStockThreshold}
                    />
                  </div>
                  <p className="mono mt-2 text-xs text-muted-foreground">
                    {p.barcode ?? "No barcode"} · Cost {fmt(p.purchaseCost)}
                  </p>
                </div>
              ))}
            </div>

            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPage={setPage}
            />
          </>
        )}
      </section>

      {/* Delete product confirmation dialog */}
      <Dialog
        open={!!deleteProductItem}
        onOpenChange={(open) => !open && setDeleteProductItem(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 size={18} /> Delete Product
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{deleteProductItem?.name}</strong>?
          </DialogDescription>
          <p className="text-xs text-muted-foreground mt-2">
            This will permanently remove the product and its images from your active catalogue.
          </p>
          <div className="dialog-actions mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteProductItem(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteProductItem && deleteMutation.mutate(deleteProductItem.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(res) => {
          setScannerOpen(false);
          setSearch(res.barcode);
          setDebouncedSearch(res.barcode);
        }}
        title="Scan Barcode to Find Product"
        description="Position barcode in viewfinder to filter catalogue."
      />
    </AppShell>
  );
}

// ─── ProductFormPage ──────────────────────────────────────────────

export function ProductFormPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Fetch existing product for edit mode
  const { data: existing, isLoading: loadingProduct } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  });

  // Fetch tax categories
  const { data: taxCats } = useQuery({
    queryKey: ["tax-categories"],
    queryFn: () => taxCategoriesApi.list(),
  });

  const [barcode, setBarcode] = useState("");
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [sellingPrice, setSellingPrice] = useState<number | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(true);
  const [taxCategoryId, setTaxCategoryId] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Model & Serial fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [color, setColor] = useState("");
  const [hsnCode, setHsnCode] = useState("8517");
  const [trackSerial, setTrackSerial] = useState(true);
  const [duplicateError, setDuplicateError] = useState<{
    message: string;
    existingProductId?: string;
  } | null>(null);

  // Model lookup autocomplete for new products
  const [modelSearch, setModelSearch] = useState("");
  const { data: modelSearchResults } = useQuery({
    queryKey: ["model-search", modelSearch],
    queryFn: () => productsApi.searchModels(modelSearch),
    enabled: !id && modelSearch.trim().length >= 2,
  });

  // Barcode scanning & validation state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [existingBarcodeProduct, setExistingBarcodeProduct] = useState<ApiProduct | null>(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState<"idle" | "checking" | "found" | "available">(
    "idle",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Check barcode uniqueness in active shop
  const checkBarcode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setExistingBarcodeProduct(null);
      setBarcodeStatus("idle");
      return;
    }
    setCheckingBarcode(true);
    setBarcodeStatus("checking");
    try {
      const found = await productsApi.scan(trimmed);
      if (found && found.id !== id) {
        setExistingBarcodeProduct(found);
        setBarcodeStatus("found");
        toast.warning(`Product "${found.name}" already exists with this barcode!`);
      } else {
        setExistingBarcodeProduct(null);
        setBarcodeStatus("available");
      }
    } catch {
      // 404 indicates barcode is not registered in this shop -> available
      setExistingBarcodeProduct(null);
      setBarcodeStatus("available");
    } finally {
      setCheckingBarcode(false);
    }
  };

  const handleBarcodeScanResult = (result: { barcode: string; format: string }) => {
    setBarcode(result.barcode);
    setScannerOpen(false);
    checkBarcode(result.barcode);
    toast.success(`Scanned: ${result.barcode}`);
  };

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setBarcode(existing.barcode ?? "");
      setBrand(existing.brand ?? "");
      setModel(existing.model ?? "");
      setVariant(existing.variant ?? "");
      setColor(existing.color ?? "");
      setHsnCode(existing.hsnCode ?? "8517");
      setTrackSerial(existing.trackSerial ?? false);
      setPurchaseCost(existing.purchaseCost);
      setSellingPrice(existing.defaultSellingPrice);
      setIsPublished(existing.isPublished);
      setTaxCategoryId(existing.taxCategoryId ?? "");
      const primaryImg = existing.images?.find((i) => i.isPrimary) ?? existing.images?.[0];
      if (primaryImg) setImagePreview(primaryImg.url);
    }
  }, [existing]);

  // Live tax rate calculation
  const selectedTaxRate = taxCats?.find((t) => t.id === taxCategoryId)?.rate ?? 0;
  const baseValue =
    sellingPrice && sellingPrice > 0
      ? Number((sellingPrice / (1 + selectedTaxRate / 100)).toFixed(2))
      : 0;
  const gstValue =
    sellingPrice && sellingPrice > 0 ? Number((sellingPrice - baseValue).toFixed(2)) : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDuplicateError(null);
    const form = new FormData(e.currentTarget);
    const str = (key: string) => (form.get(key) as string | null) ?? "";
    const num = (key: string) => Number(form.get(key));

    const finalName = (str("name") || name).trim();
    if (!finalName) {
      toast.error("Product name is required.");
      return;
    }
    if (purchaseCost < 0) {
      toast.error("Purchase cost cannot be negative.");
      return;
    }
    if (sellingPrice !== undefined && sellingPrice < 0) {
      toast.error("Selling price cannot be negative.");
      return;
    }

    // Prevent submitting duplicate product if barcode already exists
    if (!id && existingBarcodeProduct) {
      toast.error(
        "A product with this barcode already exists. Please receive stock instead or change barcode.",
      );
      return;
    }

    const cleanTaxCategoryId = taxCategoryId && taxCategoryId !== "none" ? taxCategoryId : null;

    const payload = {
      name: finalName,
      barcode: barcode.trim() ? barcode.trim() : id ? null : undefined,
      brand: (str("brand") || brand).trim() || (id ? null : undefined),
      model: (str("model") || model).trim() || (id ? null : undefined),
      variant: (str("variant") || variant).trim() || (id ? null : undefined),
      color: (str("color") || color).trim() || (id ? null : undefined),
      hsnCode: (str("hsnCode") || hsnCode).trim() || (id ? null : undefined),
      trackSerial,
      category: str("category").trim() || (id ? null : undefined),
      description: str("description").trim() || (id ? null : undefined),
      purchaseCost,
      defaultSellingPrice: sellingPrice !== undefined ? sellingPrice : id ? null : undefined,
      lowStockThreshold: num("lowStockThreshold") || 5,
      warranty: str("warranty").trim() || (id ? null : undefined),
      taxCategoryId: cleanTaxCategoryId,
      isPublished,
    };

    setSubmitting(true);
    try {
      if (id) {
        // Edit mode
        const updated = await productsApi.update(id, payload);
        // Upload image if newly selected
        if (imageFile) {
          try {
            await imagesApi.upload(updated.id, imageFile);
          } catch (imgErr) {
            toast.error("Image upload failed: " + getErrorMessage(imgErr));
          }
        }
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["product", id] });
        toast.success("Product updated successfully.");
      } else {
        // Create mode
        const initialStock = num("initialStock");
        const created = await productsApi.create({
          ...payload,
          initialStock: initialStock > 0 ? initialStock : undefined,
        });
        if (imageFile) {
          try {
            await imagesApi.upload(created.id, imageFile);
          } catch (imgErr) {
            toast.error("Product created, but image upload failed: " + getErrorMessage(imgErr));
          }
        }
        qc.invalidateQueries({ queryKey: ["products"] });
        toast.success("Product created successfully.");
      }
      navigate({ to: "/products" });
    } catch (err: unknown) {
      const errResponse = (err as {
        response?: {
          status?: number;
          data?: { code?: string; error?: string; existingProductId?: string };
        };
      })?.response;
      if (errResponse?.data?.code === "DUPLICATE_MODEL" || errResponse?.status === 409) {
        setDuplicateError({
          message:
            errResponse.data.error ||
            "A product model variant with this brand, model, variant, and color already exists.",
          existingProductId: errResponse.data.existingProductId,
        });
        toast.error("Duplicate model detected! See banner on form.");
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function processImageFile(file: File | undefined | null) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a valid JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    processImageFile(e.target.files?.[0]);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  if (id && loadingProduct) {
    return (
      <AppShell title="Products">
        <div className="form-wrap">
          <SkeletonRows rows={8} />
        </div>
      </AppShell>
    );
  }

  if (id && !existing && !loadingProduct) {
    return (
      <AppShell title="Products">
        <EmptyState title="Product not found" detail="This product may have been removed." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Products">
      <div className="form-wrap">
        <PageHeader
          title={id ? "Edit product" : "Add product"}
          subtitle={
            id
              ? "Update this product's details and pricing."
              : "Scan a manufacturer barcode or enter details manually."
          }
        />

        {/* Duplicate model alert banner */}
        {duplicateError && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-4 text-rose-900 dark:text-rose-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold text-sm">Duplicate Model Variant Detected</h4>
                <p className="text-xs">{duplicateError.message}</p>
                {duplicateError.existingProductId && (
                  <div className="pt-1">
                    <Button
                      asChild
                      size="sm"
                      className="bg-rose-700 hover:bg-rose-800 text-white font-medium"
                    >
                      <Link to="/products/$id/edit" params={{ id: duplicateError.existingProductId }}>
                        Go to Existing Model Variant &amp; Add Stock
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Model Autocomplete / Type-ahead (when adding new product) */}
        {!id && (
          <div className="panel mb-4 p-4 bg-muted/20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Boxes size={14} /> Quick Model Lookup
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Search by brand or model (e.g. "Oppo A6x", "Vivo Y28") to avoid creating duplicate models.
            </p>
            <div className="relative">
              <SearchInput
                value={modelSearch}
                onChange={setModelSearch}
                placeholder="Type brand or model name…"
              />
              {modelSearchResults && modelSearchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background rounded-lg border shadow-lg max-h-56 overflow-y-auto divide-y">
                  {modelSearchResults.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 hover:bg-muted/50 cursor-pointer flex justify-between items-center text-xs"
                      onClick={() => {
                        setName(m.name);
                        setBrand(m.brand ?? "");
                        setModel(m.model ?? "");
                        setVariant(m.variant ?? "");
                        setColor(m.color ?? "");
                        setHsnCode(m.hsnCode ?? "8517");
                        setTrackSerial(m.trackSerial ?? false);
                        if (m.defaultSellingPrice) setSellingPrice(m.defaultSellingPrice);
                        setModelSearch("");
                        toast.success(`Selected model: ${m.name}`);
                      }}
                    >
                      <div>
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {[m.brand, m.model, m.variant, m.color].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-emerald-600 block">
                          {m.inStockCount ?? 0} in stock
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.defaultSellingPrice ? fmt(m.defaultSellingPrice) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="panel">
            <div className="panel-body">
              {/* Identification & Barcode Scanning */}
              <section className="form-section">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="m-0">Barcode &amp; Identification</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScannerOpen(true)}
                    className="border-emerald-600/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <Camera size={16} className="mr-1.5" />
                    Scan Barcode
                  </Button>
                </div>

                <div className="form-grid">
                  <div className="form-full">
                    <Field label="Manufacturer Barcode (Optional for Serialized items)">
                      <div className="flex gap-2">
                        <Input
                          name="barcode"
                          value={barcode}
                          onChange={(e) => {
                            setBarcode(e.target.value);
                            if (barcodeStatus !== "idle") setBarcodeStatus("idle");
                          }}
                          onBlur={() => {
                            if (barcode.trim()) checkBarcode(barcode);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              checkBarcode(barcode);
                            }
                          }}
                          placeholder="Point camera, use USB scanner, or type barcode…"
                          className="font-mono flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => checkBarcode(barcode)}
                          disabled={!barcode.trim() || checkingBarcode}
                        >
                          {checkingBarcode ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            "Check"
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setScannerOpen(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Open Camera Scanner"
                        >
                          <Camera size={16} />
                          <span className="hidden sm:inline ml-1">Scan</span>
                        </Button>
                      </div>
                    </Field>
                  </div>

                  {id && (
                    <Field label="Internal Product ID">
                      <Input
                        readOnly
                        value={existing?.id ?? "—"}
                        className="bg-muted font-mono text-xs"
                      />
                    </Field>
                  )}
                </div>

                {/* Status alert for duplicate product */}
                {existingBarcodeProduct && !id && (
                  <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1 space-y-2">
                        <h4 className="font-semibold text-sm">
                          Product Already Exists with this Barcode!
                        </h4>
                        <p className="text-xs">
                          <strong>{existingBarcodeProduct.name}</strong>
                          {existingBarcodeProduct.brand && ` (${existingBarcodeProduct.brand})`}
                          {existingBarcodeProduct.inventory != null &&
                            ` · Current Stock: ${existingBarcodeProduct.inventory.quantity} units`}
                          {existingBarcodeProduct.defaultSellingPrice != null &&
                            ` · Price: ₹${existingBarcodeProduct.defaultSellingPrice}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          To avoid creating duplicates, you can receive additional stock for this
                          existing product or edit its details.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            asChild
                            size="sm"
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Link to="/inventory/receive">
                              <Boxes size={14} className="mr-1" /> Receive Stock
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/products/$id/edit"
                              params={{ id: existingBarcodeProduct.id }}
                            >
                              <Pencil size={14} className="mr-1" /> Edit Product
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => {
                              setBarcode("");
                              setExistingBarcodeProduct(null);
                              setBarcodeStatus("idle");
                            }}
                          >
                            Clear Barcode
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {barcodeStatus === "available" && barcode.trim() && !existingBarcodeProduct && (
                  <div className="mt-2 text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 size={14} /> Barcode is available for registration.
                  </div>
                )}
              </section>

              {/* Basic details */}
              <section className="form-section">
                <h2>Model Variant Details</h2>
                <div className="form-grid">
                  <Field label="Product name *">
                    <Input
                      name="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Oppo A6x 4/64 Ice Blue"
                    />
                  </Field>
                  <Field label="Category">
                    <Input
                      name="category"
                      defaultValue={existing?.category ?? "Mobile Phones"}
                      placeholder="e.g. Mobile Phones, Tablets"
                    />
                  </Field>
                  <Field label="Brand">
                    <Input
                      name="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Oppo, Vivo, Samsung, Realme"
                    />
                  </Field>
                  <Field label="Model Name / Code">
                    <Input
                      name="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. A6x, CPH2823, Y28"
                    />
                  </Field>
                  <Field label="Variant / Storage">
                    <Input
                      name="variant"
                      value={variant}
                      onChange={(e) => setVariant(e.target.value)}
                      placeholder="e.g. 4/64, 6/128, 8/256"
                    />
                  </Field>
                  <Field label="Color">
                    <Input
                      name="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="e.g. Ice Blue, Midnight Black"
                    />
                  </Field>
                  <Field label="HSN Code (default 8517 for phones)">
                    <Input
                      name="hsnCode"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      placeholder="8517"
                    />
                  </Field>
                  <div className="form-full">
                    <Field label="Description">
                      <Textarea
                        name="description"
                        defaultValue={existing?.description}
                        rows={2}
                        placeholder="Model specifications, notes, supplier model code…"
                      />
                    </Field>
                  </div>
                </div>

                <div className="toggle-field mt-3">
                  <div>
                    <h3 className="font-semibold text-sm">Track individual IMEI numbers</h3>
                    <p className="text-xs text-muted-foreground">
                      Enable for mobile phones &amp; tablets to track each physical phone unit by IMEI.
                    </p>
                  </div>
                  <Switch
                    checked={trackSerial}
                    onCheckedChange={setTrackSerial}
                    aria-label="Track individual IMEI numbers"
                  />
                </div>
              </section>

              {/* Pricing & inventory */}
              <section className="form-section">
                <h2>Pricing &amp; Tax Details</h2>
                <div className="form-grid">
                  <Field label="Default Selling Price (₹ Incl. GST)">
                    <Input
                      name="defaultSellingPrice"
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellingPrice ?? ""}
                      onChange={(e) =>
                        setSellingPrice(e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="e.g. 8999.00"
                    />
                  </Field>
                  <Field label="Estimated Purchase Cost (₹) *">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(Number(e.target.value))}
                      required
                    />
                  </Field>
                  <Field label="GST / Tax category">
                    <Select
                      value={taxCategoryId || "none"}
                      onValueChange={(val) => setTaxCategoryId(val === "none" ? "" : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (0%)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (0%)</SelectItem>
                        {taxCats?.map((tc) => (
                          <SelectItem key={tc.id} value={tc.id}>
                            {tc.name} ({tc.rate}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {!id && !trackSerial && (
                    <Field label="Opening stock (units)">
                      <Input name="initialStock" type="number" min={0} defaultValue={0} />
                    </Field>
                  )}
                  <Field label="Low-stock threshold">
                    <Input
                      name="lowStockThreshold"
                      type="number"
                      min={0}
                      defaultValue={existing?.lowStockThreshold ?? 5}
                    />
                  </Field>
                  <Field label="Warranty Note">
                    <Input
                      name="warranty"
                      defaultValue={existing?.warranty ?? "1 Year Manufacturer Warranty"}
                      placeholder="e.g. 1 Year Manufacturer Warranty"
                    />
                  </Field>
                </div>

                {/* Live GST Price Breakdown Card */}
                {sellingPrice != null && sellingPrice > 0 && (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-3.5 space-y-1.5 text-xs">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                      Tax Calculation (GST-Inclusive Pricing)
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-foreground">
                      <span>Customer Pays (Gross):</span>
                      <span className="text-emerald-700 dark:text-emerald-400">{fmt(sellingPrice)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxable Value (Ex-GST Base):</span>
                      <span className="font-mono">{fmt(baseValue)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST Amount ({selectedTaxRate}%):</span>
                      <span className="font-mono">{fmt(gstValue)}</span>
                    </div>
                  </div>
                )}

                <div className="toggle-field mt-3">
                  <div>
                    <h3>Published in catalogue</h3>
                    <p>Show this product on the public storefront.</p>
                  </div>
                  <Switch
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                    aria-label="Published in catalogue"
                  />
                </div>
              </section>

              {/* Product Image with Cloudinary support */}
              <section className="form-section">
                <h2>Product image (Cloudinary)</h2>
                {imagePreview ? (
                  <div className="space-y-3">
                    <div className="relative inline-block border rounded-lg p-2 bg-muted/20">
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        className="max-h-48 max-w-full rounded object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow"
                        onClick={handleRemoveImage}
                        title="Remove image"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} className="mr-1.5" /> Replace Image
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera size={14} className="mr-1.5" /> Retake Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="dropzone">
                    <Upload size={28} className="text-muted-foreground mb-1" />
                    <span className="font-medium">Select an image or capture with camera</span>
                    <small className="text-muted-foreground">
                      Supported: JPEG, PNG, WebP (Max 5MB)
                    </small>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} className="mr-1.5" /> Choose File
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera size={14} className="mr-1.5" /> Take Photo
                      </Button>
                    </div>
                  </div>
                )}

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageChange}
                />
                {!id && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Image will be uploaded directly to Cloudinary and linked upon saving.
                  </p>
                )}
              </section>
            </div>
          </div>

          <div className="form-actions flex justify-between items-center flex-wrap gap-2">
            {id ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
              >
                <Trash2 size={15} className="mr-1.5" /> Delete product
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button asChild variant="outline" type="button">
                <Link to="/products">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={submitting || (!id && !!existingBarcodeProduct)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? "Saving…" : id ? "Save changes" : "Create product"}
              </Button>
            </div>
          </div>
        </form>

        {/* Stock Units Manager for Edit mode on serialized products */}
        {id && existing?.trackSerial && (
          <div className="mt-8">
            <section className="panel panel-body">
              <div className="mb-4">
                <h2 className="text-base font-bold">IMEI / Serial Numbers Stock</h2>
                <p className="text-xs text-muted-foreground">
                  Individual phone units for this model variant. Add, review, mark damaged, or return units.
                </p>
              </div>
              <StockUnitsManager
                productId={id}
                productName={existing.name}
                defaultPurchaseCost={existing.purchaseCost}
                defaultSellingPrice={existing.defaultSellingPrice}
              />
            </section>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog for Edit mode */}
      {id && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-md">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={18} /> Delete Product
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{existing?.name}</strong>?
            </DialogDescription>
            <p className="text-xs text-muted-foreground mt-2">
              This will remove the product and its images from your active catalogue.
            </p>
            <div className="dialog-actions mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const res = await productsApi.delete(id);
                    qc.invalidateQueries({ queryKey: ["products"] });
                    if (res?.archived) {
                      toast.info(res.message || "Product archived because of historical sales.");
                    } else {
                      toast.success("Product deleted successfully.");
                    }
                    navigate({ to: "/products" });
                  } catch (err) {
                    toast.error(getErrorMessage(err));
                  }
                }}
              >
                Delete Product
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Barcode scanner dialog */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleBarcodeScanResult}
        title="Scan Product Barcode"
        description="Position the barcode inside the camera frame or enter it manually."
      />
    </AppShell>
  );
}

// ─── InventoryPage ────────────────────────────────────────────────

export function InventoryPage() {
  useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "low" | "movements">("all");
  const [page, setPage] = useState(1);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [reconciling, setReconciling] = useState(false);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await inventoryApi.reconcile();
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `Reconciled ${res.reconciledCount} product(s) (${res.discrepanciesFixed} discrepancies fixed).`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReconciling(false);
    }
  };

  const allQuery = useQuery({
    queryKey: ["inventory", "all", page],
    queryFn: () => inventoryApi.list({ page }),
    enabled: tab === "all",
  });

  const lowQuery = useQuery({
    queryKey: ["inventory", "low", page],
    queryFn: () => inventoryApi.lowStock({ page }),
    enabled: tab === "low",
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements", page],
    queryFn: () => inventoryApi.movements({ page }),
    enabled: tab === "movements",
  });

  const allItems = allQuery.data?.items ?? [];
  const lowItems = lowQuery.data?.items ?? [];
  const movements = movementsQuery.data?.movements ?? [];

  // Metrics from "all" query
  const totalSKUs = allQuery.data?.pagination.total ?? 0;
  const totalUnits = allItems.reduce((s, i) => s + i.quantity, 0);
  const lowStockCount = allItems.filter((i) => i.quantity <= i.product.lowStockThreshold).length;

  const adjustMutation = useMutation({
    mutationFn: (vars: { productId: string; delta: number; reason: string }) =>
      inventoryApi.adjust({
        productId: vars.productId,
        quantityDelta: vars.delta,
        movementType: "ADJUSTMENT",
        notes: vars.reason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Stock adjusted.");
      setAdjustItem(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function renderInventoryTable(
    items: InventoryItem[],
    isLoading: boolean,
    isError: boolean,
    error: unknown,
    refetch: () => void,
  ) {
    if (isLoading) return <SkeletonRows />;
    if (isError)
      return (
        <div className="p-4">
          <ErrorAlert message={getErrorMessage(error)} onRetry={refetch} />
        </div>
      );
    if (!items.length)
      return <EmptyState title="No items" detail="Nothing to show for this view." />;
    return (
      <>
        <div className="table-scroll desktop-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Qty</th>
                <th>Threshold</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="table-product">
                      {item.product.images?.[0] ? (
                        <img
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          width={36}
                          height={36}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                          <Package size={16} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="truncate block font-medium">{item.product.name}</span>
                        {item.product.trackSerial && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                            <Boxes size={10} /> IMEI Tracked
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="mono">{item.product.barcode ?? "—"}</td>
                  <td className="font-medium">{item.quantity}</td>
                  <td>{item.product.lowStockThreshold}</td>
                  <td>{fmt(item.product.purchaseCost)}</td>
                  <td>
                    {item.product.defaultSellingPrice != null
                      ? fmt(item.product.defaultSellingPrice)
                      : "—"}
                  </td>
                  <td>
                    <ApiStatusBadge
                      isActive
                      qty={item.quantity}
                      threshold={item.product.lowStockThreshold}
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Adjust stock for ${item.product.name}`}
                      onClick={() => {
                        setAdjustItem(item);
                        setAdjustDelta(0);
                        setAdjustReason("");
                      }}
                    >
                      <Boxes size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile */}
        <div className="mobile-records">
          {items.map((item) => (
            <div className="mobile-record" key={item.id}>
              <div className="mobile-record-top">
                <span className="font-medium truncate">{item.product.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setAdjustItem(item);
                    setAdjustDelta(0);
                    setAdjustReason("");
                  }}
                >
                  <Boxes size={15} />
                </Button>
              </div>
              <div className="mobile-record-meta">
                <span>
                  {item.quantity} units · threshold {item.product.lowStockThreshold}
                </span>
                <ApiStatusBadge
                  isActive
                  qty={item.quantity}
                  threshold={item.product.lowStockThreshold}
                />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <AppShell title="Inventory">
      <PageHeader title="Inventory" subtitle="Track stock levels across your catalogue.">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconcile}
            disabled={reconciling}
            title="Recalculate cached stock from physical units"
          >
            <RefreshCw size={14} className={`mr-1.5 ${reconciling ? "animate-spin" : ""}`} />
            {reconciling ? "Reconciling…" : "Reconcile Stock"}
          </Button>
          <Button asChild>
            <Link to="/inventory/receive">
              <ArrowDownToLine size={16} />
              Receive Stock
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* Metrics */}
      <div className="metric-grid">
        <MetricCard
          label="Total SKUs"
          value={String(totalSKUs)}
          detail="Products with inventory records"
          icon={Package}
        />
        <MetricCard
          label="Total units"
          value={String(totalUnits)}
          detail="Across all products (current page)"
          icon={Boxes}
        />
        <MetricCard
          label="Low-stock"
          value={String(lowStockCount)}
          detail="At or below threshold (current page)"
          icon={TriangleAlert}
        />
      </div>

      <section className="panel">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as typeof tab);
            setPage(1);
          }}
        >
          <div className="px-4 pt-4">
            <TabsList>
              <TabsTrigger value="all">All Stock</TabsTrigger>
              <TabsTrigger value="low">Low Stock</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all">
            {renderInventoryTable(
              allItems,
              allQuery.isLoading,
              allQuery.isError,
              allQuery.error,
              () => allQuery.refetch(),
            )}
            <Pagination
              page={page}
              totalPages={allQuery.data?.pagination.totalPages ?? 1}
              onPage={setPage}
            />
          </TabsContent>

          <TabsContent value="low">
            {renderInventoryTable(
              lowItems,
              lowQuery.isLoading,
              lowQuery.isError,
              lowQuery.error,
              () => lowQuery.refetch(),
            )}
            <Pagination
              page={page}
              totalPages={lowQuery.data?.pagination.totalPages ?? 1}
              onPage={setPage}
            />
          </TabsContent>

          <TabsContent value="movements">
            {movementsQuery.isLoading ? (
              <SkeletonRows />
            ) : movementsQuery.isError ? (
              <div className="p-4">
                <ErrorAlert
                  message={getErrorMessage(movementsQuery.error)}
                  onRetry={() => movementsQuery.refetch()}
                />
              </div>
            ) : !movements.length ? (
              <EmptyState title="No movements" detail="Stock movements will appear here." />
            ) : (
              <>
                <div className="table-scroll desktop-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Qty delta</th>
                        <th>Unit cost</th>
                        <th>Notes</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((mv: StockMovement) => (
                        <tr key={mv.id}>
                          <td>{mv.product?.name ?? mv.productId}</td>
                          <td>
                            <span className="mono text-xs">{mv.movementType}</span>
                          </td>
                          <td
                            className={
                              mv.quantityDelta >= 0
                                ? "text-green-600 font-medium"
                                : "text-destructive font-medium"
                            }
                          >
                            {mv.quantityDelta >= 0 ? "+" : ""}
                            {mv.quantityDelta}
                          </td>
                          <td>{fmt(mv.unitCost)}</td>
                          <td className="text-muted-foreground text-sm">{mv.notes ?? "—"}</td>
                          <td className="text-sm text-muted-foreground">
                            {new Date(mv.createdAt).toLocaleDateString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  totalPages={movementsQuery.data?.pagination.totalPages ?? 1}
                  onPage={setPage}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Adjust stock dialog */}
      <Dialog
        open={!!adjustItem}
        onOpenChange={(v) => {
          if (!v) setAdjustItem(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Adjust stock — {adjustItem?.product.name}</DialogTitle>
          {adjustItem?.product.trackSerial ? (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-amber-900 dark:text-amber-200">
                <strong>Serialized Model Product:</strong> Direct quantity adjustments are disabled for phone models.
                Stock count is calculated directly from physical in-stock IMEI units.
              </div>
              <p className="text-muted-foreground">
                To adjust stock for this phone model, manage individual IMEI units (add, delete, mark damaged, or return).
              </p>
              <div className="dialog-actions pt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdjustItem(null)}>
                  Close
                </Button>
                <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link to="/products/$id/edit" params={{ id: adjustItem.productId }}>
                    Manage Stock Units (IMEIs)
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DialogDescription>
                Current quantity: <strong>{adjustItem?.quantity ?? 0}</strong>. Enter a positive or
                negative delta.
              </DialogDescription>
              <Field label="Quantity delta (e.g. +10 or -3)">
                <Input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                />
              </Field>
              <Field label="Reason (optional)">
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Damage, count correction…"
                />
              </Field>
              <div className="dialog-actions">
                <Button variant="outline" onClick={() => setAdjustItem(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={adjustDelta === 0 || adjustMutation.isPending}
                  onClick={() => {
                    if (adjustItem)
                      adjustMutation.mutate({
                        productId: adjustItem.productId,
                        delta: adjustDelta,
                        reason: adjustReason,
                      });
                  }}
                >
                  {adjustMutation.isPending ? "Saving…" : "Confirm adjustment"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── ReceiveStockPage ─────────────────────────────────────────────

export function ReceiveStockPage() {
  useAuth();
  const qc = useQueryClient();
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ApiProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [done, setDone] = useState(false);
  const [newQty, setNewQty] = useState(0);
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function handleScan(codeToScan?: string) {
    const code = (codeToScan ?? barcode).trim();
    if (!code) return;
    setScanning(true);
    setScannedProduct(null);
    setNotFound(false);
    try {
      const product = await productsApi.scan(code);
      setScannedProduct(product);
      setUnitCost(product.purchaseCost);
      toast.success(`Product found: ${product.name}`);
    } catch {
      setNotFound(true);
      toast.error(`Product not found for barcode "${code}"`);
    } finally {
      setScanning(false);
    }
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!scannedProduct) return;
    if (qty < 1) {
      toast.error("Quantity must be at least 1.");
      return;
    }
    if (unitCost < 0) {
      toast.error("Unit cost cannot be negative.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await inventoryApi.receive({
        productId: scannedProduct.id,
        quantity: qty,
        unitCost,
        notes: notes || undefined,
      });
      setNewQty(result.inventory.quantity);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setDone(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setBarcode("");
    setScannedProduct(null);
    setNotFound(false);
    setDone(false);
    setQty(1);
    setUnitCost(0);
    setNotes("");
  }

  return (
    <AppShell title="Receive Stock">
      <div className="receive-wrap">
        <PageHeader title="Receive stock" subtitle="Scan a barcode and record a delivery." />

        <div className="panel panel-body">
          {done ? (
            <div className="success-state">
              <CheckCircle2 size={45} />
              <h2>Stock received</h2>
              <p>
                <strong>{scannedProduct?.name}</strong> — new stock level:{" "}
                <strong>{newQty} units</strong>.
              </p>
              <Button onClick={reset}>Receive another product</Button>
            </div>
          ) : (
            <>
              {/* Barcode scan row */}
              <div className="barcode-row">
                <Field label="Manufacturer barcode">
                  <Input
                    aria-label="Manufacturer barcode"
                    value={barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      setScannedProduct(null);
                      setNotFound(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleScan();
                      }
                    }}
                    placeholder="Scan or type barcode…"
                  />
                </Field>
                <div className="flex gap-2 self-end">
                  <Button
                    onClick={() => handleScan()}
                    disabled={scanning || !barcode.trim()}
                    variant="outline"
                  >
                    <ScanLine size={16} className="mr-1.5" /> {scanning ? "Scanning…" : "Lookup"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Camera size={16} className="mr-1.5" /> Camera
                  </Button>
                </div>
              </div>

              {scannedProduct && (
                <div className="hint">
                  <div className="table-product">
                    {scannedProduct.images?.[0] ? (
                      <img
                        src={scannedProduct.images[0].url}
                        alt={scannedProduct.name}
                        width={40}
                        height={40}
                        className="rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Package size={16} className="text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <strong>{scannedProduct.name}</strong>
                      <p className="text-sm text-muted-foreground">
                        {[scannedProduct.brand, scannedProduct.model].filter(Boolean).join(" · ")}
                        {scannedProduct.inventory != null &&
                          ` · Current stock: ${scannedProduct.inventory.quantity} units`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {notFound && barcode && (
                <div className="hint">
                  <p className="font-medium text-destructive">
                    Product not found for barcode "{barcode}".
                  </p>
                  <Button asChild variant="link" className="p-0 h-auto">
                    <Link to="/products/new">
                      Register product <Plus size={14} />
                    </Link>
                  </Button>
                </div>
              )}

              {scannedProduct?.trackSerial ? (
                <div className="mt-6 border-t pt-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-foreground">
                      Receive Serialized Phone Units (IMEIs)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      This product model tracks stock by individual IMEI numbers. Enter or scan IMEIs below.
                    </p>
                  </div>
                  <ImeiBulkInput
                    productId={scannedProduct.id}
                    productName={scannedProduct.name}
                    defaultPurchaseCost={scannedProduct.purchaseCost}
                    defaultSellingPrice={scannedProduct.defaultSellingPrice}
                    onSuccess={(count) => {
                      setNewQty((scannedProduct.inventory?.quantity ?? 0) + count);
                      qc.invalidateQueries({ queryKey: ["inventory"] });
                      qc.invalidateQueries({ queryKey: ["products"] });
                      setDone(true);
                    }}
                    onCancel={reset}
                  />
                </div>
              ) : (
                <form className="mt-6" onSubmit={handleReceive}>
                  <div className="form-grid">
                    <Field label="Quantity received *">
                      <Input
                        type="number"
                        min={1}
                        required
                        value={qty}
                        onChange={(e) => setQty(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Unit purchase cost (₹) *">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={unitCost}
                        onChange={(e) => setUnitCost(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Notes (optional)">
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Supplier name, delivery reference…"
                      />
                    </Field>
                  </div>
                  <Button
                    type="submit"
                    disabled={!scannedProduct || submitting}
                    className="w-full mt-6"
                  >
                    {submitting ? "Saving…" : "Confirm receipt"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(res) => {
          setBarcode(res.barcode);
          setScannerOpen(false);
          void handleScan(res.barcode);
        }}
        title="Scan Barcode to Receive Stock"
        description="Position the barcode within the camera viewfinder."
      />
    </AppShell>
  );
}

// ─── Date-range helper (for dashboard & reports) ──────────────────

function rangeFor(option: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const localYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (option === "Today") {
    const d = localYmd(now);
    return { from: d, to: d };
  }
  if (option === "Last month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: localYmd(first), to: localYmd(last) };
  }
  if (option === "This week") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    return { from: localYmd(monday), to: localYmd(now) };
  }
  if (option === "This year") {
    const first = new Date(now.getFullYear(), 0, 1);
    return { from: localYmd(first), to: localYmd(now) };
  }
  if (option === "All time") {
    return { from: "2020-01-01", to: localYmd(now) };
  }
  // This month (default)
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: localYmd(first), to: localYmd(now) };
}

const formatDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── DashboardPage ────────────────────────────────────────────────

export function DashboardPage() {
  const { user, activeShop } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.get(),
  });

  const recentSales = data?.recentSales ?? [];
  const firstName = (user?.name ?? user?.email ?? "there").split(/[\s@]/)[0];

  return (
    <AppShell title="Dashboard">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        subtitle={`Here's what's happening at ${activeShop?.name ?? "your shop"}.`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            refetch();
          }}
        >
          <RefreshCw size={15} /> Refresh
        </Button>
        <Button asChild>
          <Link to="/billing">
            <Plus />
            New Bill
          </Link>
        </Button>
      </PageHeader>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : isError ? (
        <ErrorAlert message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : data ? (
        <>
          <div className="metric-grid">
            <MetricCard
              label="Net Sales"
              value={fmt(data.netSales)}
              detail={`${data.completedSales} completed sales`}
              icon={Wallet}
            />
            <MetricCard
              label="Gross Profit"
              value={fmt(data.grossProfit)}
              detail="Net sales minus cost of goods"
              icon={TrendingUp}
            />
            <MetricCard
              label="Low Stock"
              value={String(data.lowStockCount)}
              detail="Products at or below threshold"
              icon={TriangleAlert}
            />
            <MetricCard
              label="Period"
              value={formatDate(data.period.from)}
              detail={`to ${formatDate(data.period.to)}`}
              icon={Package}
            />
          </div>

          <div className="quick-actions">
            <Button asChild variant="outline">
              <Link to="/products/new">
                <Plus />
                Add Product
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/inventory/receive">
                <Boxes />
                Receive Stock
              </Link>
            </Button>
          </div>

          <section className="panel">
            <div className="panel-header">
              <h2>Recent sales</h2>
              <Button asChild variant="link" size="sm">
                <Link to="/sales">
                  View all
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
            </div>
            {recentSales.length ? (
              <>
                <div className="table-scroll desktop-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((s: Sale) => (
                        <tr key={s.id}>
                          <td>
                            <Link
                              to="/sales/$id"
                              params={{ id: s.id }}
                              className="text-primary font-medium"
                            >
                              {s.invoiceNumber}
                            </Link>
                          </td>
                          <td>{formatDate(s.createdAt)}</td>
                          <td className="font-medium">{fmt(s.totalAmount)}</td>
                          <td>
                            <span className="status status-success">
                              <span />
                              {s.status}
                            </span>
                          </td>
                          <td>
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              aria-label={`View ${s.invoiceNumber}`}
                            >
                              <Link to="/sales/$id" params={{ id: s.id }}>
                                <ArrowUpRight size={15} />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mobile-records">
                  {recentSales.map((s: Sale) => (
                    <Link
                      to="/sales/$id"
                      params={{ id: s.id }}
                      key={s.id}
                      className="mobile-record block"
                    >
                      <div className="mobile-record-top">
                        <strong className="text-primary">{s.invoiceNumber}</strong>
                        <strong>{fmt(s.totalAmount)}</strong>
                      </div>
                      <div className="mobile-record-meta">
                        <span>{formatDate(s.createdAt)}</span>
                        <span className="status status-success">
                          <span />
                          {s.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="No sales yet" detail="Completed sales will appear here." />
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

// ─── SalesPage ────────────────────────────────────────────────────

export function SalesPage() {
  useAuth();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sales", page],
    queryFn: () => salesApi.list({ page }),
  });

  const records = (data?.sales ?? []).filter((s) =>
    s.invoiceNumber.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <AppShell title="Sales History">
      <PageHeader title="Sales history" subtitle="Every completed sale and its invoice." />

      <section className="panel">
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by invoice…" />
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : isError ? (
          <div className="p-4">
            <ErrorAlert message={getErrorMessage(error)} onRetry={() => refetch()} />
          </div>
        ) : !records.length ? (
          <EmptyState
            title={query ? "No matching sales" : "No sales yet"}
            detail={query ? "Try another invoice number." : "Completed sales will appear here."}
          />
        ) : (
          <>
            <div className="table-scroll desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {records.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link
                          to="/sales/$id"
                          params={{ id: s.id }}
                          className="text-primary font-medium"
                        >
                          {s.invoiceNumber}
                        </Link>
                      </td>
                      <td>{formatDate(s.createdAt)}</td>
                      <td>{s.items?.length ?? 0}</td>
                      <td className="font-medium">{fmt(s.totalAmount)}</td>
                      <td>{s.payments?.[0]?.method ?? "—"}</td>
                      <td>
                        <span className="status status-success">
                          <span />
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            aria-label={`Print ${s.invoiceNumber}`}
                            title="Print Bill"
                          >
                            <a
                              href={`/sales/${s.id}/print`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Printer size={15} />
                            </a>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            aria-label={`View ${s.invoiceNumber}`}
                            title="View Invoice"
                          >
                            <Link to="/sales/$id" params={{ id: s.id }}>
                              <ArrowUpRight size={15} />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-records">
              {records.map((s) => (
                <Link
                  to="/sales/$id"
                  params={{ id: s.id }}
                  key={s.id}
                  className="mobile-record block"
                >
                  <div className="mobile-record-top">
                    <strong className="text-primary">{s.invoiceNumber}</strong>
                    <strong>{fmt(s.totalAmount)}</strong>
                  </div>
                  <div className="mobile-record-meta">
                    <span>
                      {formatDate(s.createdAt)} · {s.payments?.[0]?.method ?? "—"}
                    </span>
                    <span className="status status-success">
                      <span />
                      {s.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <Pagination
              page={data!.pagination.page}
              totalPages={data!.pagination.totalPages}
              onPage={setPage}
            />
          </>
        )}
      </section>
    </AppShell>
  );
}

// ─── InvoicePage ──────────────────────────────────────────────────

export function InvoicePage() {
  const { id } = useParams({ strict: false });

  const {
    data: sale,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => salesApi.get(id!),
    enabled: !!id,
  });

  return (
    <AppShell title="Invoice">
      <PageHeader title="Invoice preview" subtitle="A record of this sale.">
        <Button asChild variant="outline">
          <Link to="/sales">
            <ArrowLeft size={15} />
            Back to sales
          </Link>
        </Button>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <a href={`/sales/${id}/print`} target="_blank" rel="noopener noreferrer">
            <Printer size={15} />
            Print Customer Bill
          </a>
        </Button>
      </PageHeader>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorAlert message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : !sale ? (
        <EmptyState title="Invoice not found" detail="Choose an invoice from sales history." />
      ) : (
        <div className="invoice">
          {sale.status === "CANCELLED" && (
            <div className="mb-4 rounded-md border-2 border-dashed border-red-600 bg-red-50/70 p-3 text-center text-red-700">
              <span className="text-lg font-black tracking-widest sm:text-xl">
                *** CANCELLED SALE ***
              </span>
              <p className="text-xs font-semibold mt-0.5">
                This transaction has been voided. Refund processed.
              </p>
            </div>
          )}

          <div className="invoice-header">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {sale.shop?.name ?? "Time Centre Mobile & Electronics"}
              </h3>
              {sale.shop?.address && (
                <p className="text-xs text-muted-foreground">{sale.shop.address}</p>
              )}
              {(sale.shop?.contactPhone || sale.shop?.contactEmail) && (
                <p className="text-xs text-muted-foreground">
                  {[sale.shop?.contactPhone, sale.shop?.contactEmail].filter(Boolean).join(" · ")}
                </p>
              )}
              {sale.shop?.gstin && (
                <p className="text-xs font-semibold text-foreground mt-0.5">
                  GSTIN: {sale.shop.gstin}
                </p>
              )}
              {(sale.customerName || sale.customerPhone) && (
                <div className="mt-3 text-xs border-t pt-2">
                  <span className="font-semibold text-foreground">Billed to: </span>
                  {sale.customerName && <span>{sale.customerName}</span>}
                  {sale.customerName && sale.customerPhone && <span> · </span>}
                  {sale.customerPhone && <span>Tel: {sale.customerPhone}</span>}
                </div>
              )}
            </div>
            <div>
              <h2>INVOICE</h2>
              <p>
                {sale.invoiceNumber}
                <br />
                {formatDate(sale.createdAt)}
                <br />
                Payment: {sale.payments?.[0]?.method ?? "—"}
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div className="font-medium">{it.productNameSnapshot}</div>
                    {it.serialNumber && (
                      <div className="text-xs font-mono text-muted-foreground">
                        IMEI/SN: {it.serialNumber}
                      </div>
                    )}
                    {it.product?.warranty && (
                      <div className="text-xs text-emerald-800 font-medium">
                        Warranty: {it.product.warranty}
                      </div>
                    )}
                  </td>
                  <td>{it.quantity}</td>
                  <td>{fmt(it.unitSellingPrice)}</td>
                  <td>{fmt(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{fmt(sale.subtotal)}</span>
            </div>
            {sale.discountTotal > 0 && (
              <div className="summary-row">
                <span>Discount</span>
                <span>-{fmt(sale.discountTotal)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Applicable tax</span>
              <span>{fmt(sale.taxTotal)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>Total</span>
              <span>{fmt(sale.totalAmount)}</span>
            </div>
          </div>

          <div className="invoice-footer">
            <p className="font-medium text-foreground">Thank you for your business.</p>
            {sale.shop?.invoiceFooter && (
              <p className="mt-1 whitespace-pre-line text-xs">{sale.shop.invoiceFooter}</p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── ReportsPage ──────────────────────────────────────────────────

export function ReportsPage() {
  useAuth();
  const [range, setRange] = useState("This month");
  const { from, to } = useMemo(() => rangeFor(range), [range]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reports", "profit-loss", from, to],
    queryFn: () => reportsApi.profitLoss({ from, to }),
  });

  const rows: [string, string, number][] = data
    ? [
        ["Net sales", "Sales less returns and discounts", data.netSales],
        ["Cost of goods sold", "Cost of the products sold", -data.cogs],
        ["Gross profit", "Net sales minus cost of goods sold", data.grossProfit],
        ["Operating expenses", "Recorded shop expenses", -data.operatingExpenses],
        ["Net profit", "Gross profit minus operating expenses", data.netProfit],
      ]
    : [];

  return (
    <AppShell title="Profit & Loss">
      <PageHeader
        title="Profit & loss"
        subtitle="A summary of your shop's performance for the selected period."
      >
        <select
          aria-label="Report period"
          className="date-control"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option>Today</option>
          <option>This week</option>
          <option>This month</option>
          <option>Last month</option>
          <option>This year</option>
          <option>All time</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </PageHeader>

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorAlert message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : data ? (
        <>
          <div className="metric-grid">
            <MetricCard
              label="Net Sales"
              value={fmt(data.netSales)}
              detail={`${data.salesCount} sales`}
              icon={Wallet}
            />
            <MetricCard
              label="Cost of Goods Sold"
              value={fmt(data.cogs)}
              detail="Cost of products sold"
              icon={Package}
            />
            <MetricCard
              label="Gross Profit"
              value={fmt(data.grossProfit)}
              detail="Net sales minus COGS"
              icon={TrendingUp}
            />
            <MetricCard
              label="Net Profit"
              value={fmt(data.netProfit)}
              detail="After operating expenses"
              icon={Wallet}
            />
          </div>

          <section className="panel">
            <div className="panel-header">
              <h2>At a glance</h2>
              <span className="sample-caption">
                {formatDate(from)} – {formatDate(to)}
              </span>
            </div>
            <div className="panel-body">
              {rows.map(([label, detail, value]) => (
                <div className="report-row" key={label}>
                  <div>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </div>
                  <strong>{fmt(value)}</strong>
                </div>
              ))}
              <div className="hint">{data.note}</div>
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

// ─── SettingsPage ─────────────────────────────────────────────────

export function SettingsPage() {
  useAuth();
  const { refreshSession, activeShop } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [newTaxName, setNewTaxName] = useState("");
  const [newTaxRate, setNewTaxRate] = useState(0);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);

  const {
    data: shop,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shop", "current"],
    queryFn: () => shopsApi.getCurrent(),
  });

  useEffect(() => {
    if (shop) {
      setPricesIncludeTax(shop.pricesIncludeTax ?? true);
    }
  }, [shop]);

  const { data: taxCats } = useQuery({
    queryKey: ["tax-categories"],
    queryFn: () => taxCategoriesApi.list(),
  });

  const createTaxMutation = useMutation({
    mutationFn: () => taxCategoriesApi.create({ name: newTaxName.trim(), rate: newTaxRate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-categories"] });
      setNewTaxName("");
      setNewTaxRate(0);
      toast.success("Tax category added.");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteTaxMutation = useMutation({
    mutationFn: (id: string) => taxCategoriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tax-categories"] });
      toast.success("Tax category removed.");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const str = (key: string) => (form.get(key) as string | null)?.trim() ?? "";
    setSubmitting(true);
    try {
      const brandsRaw = str("brandsServiced");
      const brandsServiced = brandsRaw
        ? brandsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

      await shopsApi.updateCurrent({
        name: str("name") || undefined,
        contactPhone: str("contactPhone") || undefined,
        alternatePhone: str("alternatePhone") || undefined,
        contactEmail: str("contactEmail") || undefined,
        address: str("address") || undefined,
        state: str("state") || undefined,
        stateCode: str("stateCode") || undefined,
        gstin: str("gstin") || undefined,
        bankName: str("bankName") || undefined,
        bankAccountNo: str("bankAccountNo") || undefined,
        bankIfsc: str("bankIfsc") || undefined,
        bankBranch: str("bankBranch") || undefined,
        upiId: str("upiId") || undefined,
        tagline: str("tagline") || undefined,
        warrantyNote: str("warrantyNote") || undefined,
        brandsServiced,
        termsAndConditions: str("termsAndConditions") || undefined,
        invoicePrefix: str("invoicePrefix") || undefined,
        invoiceFooter: str("invoiceFooter") || undefined,
        pricesIncludeTax,
      });
      qc.invalidateQueries({ queryKey: ["shop"] });
      await refreshSession();
      toast.success("Shop settings saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Settings">
        <SkeletonRows rows={8} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="settings-layout">
        <PageHeader
          title="Shop settings"
          subtitle={`The details that make ${activeShop?.name ?? "your shop"} yours.`}
        />

        {isError ? (
          <ErrorAlert message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="panel panel-body space-y-6">
              {/* Basic & Address */}
              <section className="form-section">
                <h2>Shop Information &amp; Address</h2>
                <div className="form-grid">
                  <Field label="Shop name *">
                    <Input name="name" required defaultValue={shop?.name} />
                  </Field>
                  <Field label="Primary Contact Number">
                    <Input
                      name="contactPhone"
                      type="tel"
                      defaultValue={shop?.contactPhone}
                      placeholder="e.g. 7004114744"
                    />
                  </Field>
                  <Field label="Alternate / WhatsApp Number">
                    <Input
                      name="alternatePhone"
                      type="tel"
                      defaultValue={shop?.alternatePhone}
                      placeholder="e.g. 7033389366"
                    />
                  </Field>
                  <Field label="Contact email">
                    <Input
                      name="contactEmail"
                      type="email"
                      defaultValue={shop?.contactEmail}
                      placeholder="e.g. shop@example.com"
                    />
                  </Field>
                  <div className="form-full">
                    <Field label="Full Address (Akhara Chowk, Bishnugarh, Hazaribagh)">
                      <Input
                        name="address"
                        defaultValue={shop?.address}
                        placeholder="e.g. Akhara Chowk, Bishnugarh, Hazaribagh, Jharkhand"
                      />
                    </Field>
                  </div>
                  <Field label="State">
                    <Input
                      name="state"
                      defaultValue={shop?.state ?? "Jharkhand"}
                      placeholder="Jharkhand"
                    />
                  </Field>
                  <Field label="State Code">
                    <Input
                      name="stateCode"
                      defaultValue={shop?.stateCode ?? "20"}
                      placeholder="20"
                    />
                  </Field>
                  <Field label="Shop GSTIN">
                    <Input
                      name="gstin"
                      defaultValue={shop?.gstin}
                      placeholder="e.g. 20EBEPK7095A1Z0"
                    />
                  </Field>
                </div>
              </section>

              {/* Bank Details */}
              <section className="form-section">
                <h2>Bank Details (for GST Invoices)</h2>
                <div className="form-grid">
                  <Field label="Bank Name">
                    <Input
                      name="bankName"
                      defaultValue={shop?.bankName}
                      placeholder="e.g. State Bank of India"
                    />
                  </Field>
                  <Field label="Bank Account Number">
                    <Input
                      name="bankAccountNo"
                      defaultValue={shop?.bankAccountNo}
                      placeholder="Account number"
                    />
                  </Field>
                  <Field label="IFSC Code">
                    <Input
                      name="bankIfsc"
                      defaultValue={shop?.bankIfsc}
                      placeholder="e.g. SBIN0001234"
                    />
                  </Field>
                  <Field label="Branch Name">
                    <Input
                      name="bankBranch"
                      defaultValue={shop?.bankBranch}
                      placeholder="e.g. Bishnugarh Branch"
                    />
                  </Field>
                  <Field label="UPI ID / VPA">
                    <Input
                      name="upiId"
                      defaultValue={shop?.upiId}
                      placeholder="e.g. 7004114744@upi"
                    />
                  </Field>
                </div>
              </section>

              {/* Invoice & Terms */}
              <section className="form-section">
                <h2>Invoice Branding &amp; Terms</h2>
                <div className="form-grid">
                  <Field label="Tagline / Header Subtitle">
                    <Input
                      name="tagline"
                      defaultValue={shop?.tagline ?? "Mobile Sale & Service — All Types of Mobile Repairing here"}
                      placeholder="e.g. Mobile Sale & Service"
                    />
                  </Field>
                  <Field label="Warranty Note">
                    <Input
                      name="warrantyNote"
                      defaultValue={shop?.warrantyNote ?? "All warranty & guaranty by Manufacturer"}
                      placeholder="Warranty note"
                    />
                  </Field>
                  <div className="form-full">
                    <Field label="Brands Serviced (comma-separated)">
                      <Input
                        name="brandsServiced"
                        defaultValue={
                          Array.isArray(shop?.brandsServiced)
                            ? shop.brandsServiced.join(", ")
                            : typeof shop?.brandsServiced === "string"
                            ? shop.brandsServiced
                            : "NOKIA, SAMSUNG, vivo, oppo, mi, Realme, TECNO"
                        }
                        placeholder="NOKIA, SAMSUNG, vivo, oppo, mi, Realme, TECNO"
                      />
                    </Field>
                  </div>
                  <div className="form-full">
                    <Field label="Terms &amp; Conditions (Printed on Invoice)">
                      <Textarea
                        name="termsAndConditions"
                        rows={3}
                        defaultValue={
                          shop?.termsAndConditions ??
                          "1. Goods once sold will not be taken back or exchanged.\n2. All warranty & guaranty by manufacturer only.\n3. Subject to Hazaribagh jurisdiction."
                        }
                        placeholder="Terms and conditions..."
                      />
                    </Field>
                  </div>
                  <Field label="Invoice prefix">
                    <Input
                      name="invoicePrefix"
                      defaultValue={shop?.invoicePrefix}
                      placeholder="e.g. INV"
                    />
                  </Field>
                  <Field label="Invoice footer">
                    <Input
                      name="invoiceFooter"
                      defaultValue={shop?.invoiceFooter}
                      placeholder="Thank you for your business!"
                    />
                  </Field>
                </div>

                <div className="toggle-field mt-4">
                  <div>
                    <h3 className="text-sm font-semibold">Prices include GST</h3>
                    <p className="text-xs text-muted-foreground">
                      Catalogue and billing prices entered by shopkeeper are GST-inclusive.
                    </p>
                  </div>
                  <Switch
                    checked={pricesIncludeTax}
                    onCheckedChange={setPricesIncludeTax}
                    aria-label="Prices include GST"
                  />
                </div>
              </section>
            </div>

            <div className="form-actions mt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}

        <section className="panel panel-body">
          <section className="form-section">
            <h2>Tax categories</h2>
            {taxCats?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Rate</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {taxCats.map((tc) => (
                      <tr key={tc.id}>
                        <td>
                          {tc.name}
                          {tc.isDefault ? " (default)" : ""}
                        </td>
                        <td>{tc.rate}%</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${tc.name}`}
                            disabled={deleteTaxMutation.isPending}
                            onClick={() => deleteTaxMutation.mutate(tc.id)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hint">No tax categories yet. Add one below.</p>
            )}

            <div className="form-grid mt-4">
              <Field label="Name">
                <Input
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  placeholder="e.g. GST 18%"
                />
              </Field>
              <Field label="Rate (%)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(Number(e.target.value))}
                />
              </Field>
            </div>
            <Button
              variant="outline"
              className="mt-3"
              disabled={!newTaxName.trim() || createTaxMutation.isPending}
              onClick={() => createTaxMutation.mutate()}
            >
              <Store size={15} /> Add tax category
            </Button>
          </section>
        </section>
      </div>
    </AppShell>
  );
}
