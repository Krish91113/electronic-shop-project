import { useState, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  Plus,
  Trash2,
  CheckCircle2,
  ShoppingBag,
  Search,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Camera,
  Printer,
  Boxes,
} from "lucide-react";
import { BarcodeScanner } from "./barcode-scanner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppShell, PageHeader, QuantityStepper, EmptyState, Field } from "./shared";
import {
  products as productsApi,
  sales as salesApi,
  stockUnits as stockUnitsApi,
  type Product,
  type Sale,
  type StockUnit,
  getErrorMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Types & Audio ─────────────────────────────────────────────────

export type CartLine = {
  lineId: string;
  product: Product;
  qty: number;
  unitPrice: number; // inclusive selling price
  stockUnit?: StockUnit | undefined;
  imei?: string | undefined;
  imei2?: string | undefined;
  chargerNo?: string | undefined;
  serialNumber?: string | undefined;
};

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function playBeep(type: "success" | "error" = "success") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio permission/context errors
  }
}

// ─── BillingPage ─────────────────────────────────────────────────

export function BillingPage() {
  const { activeShop } = useAuth();
  const queryClient = useQueryClient();

  // Search / scan state
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [showUnknownDialog, setShowUnknownDialog] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const lastScannedCodeRef = useRef<string>("");

  // Serialized unit picker dialog
  const [unitSelectProduct, setUnitSelectProduct] = useState<Product | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");

  // Customer state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [customerAadhaar, setCustomerAadhaar] = useState("");
  const [customerState, setCustomerState] = useState("Jharkhand");
  const [customerStateCode, setCustomerStateCode] = useState("20");
  const [placeOfSupply, setPlaceOfSupply] = useState("Jharkhand");

  const [autoPrint, setAutoPrint] = useState(() => {
    try {
      return localStorage.getItem("time_centre_auto_print") === "true";
    } catch {
      return false;
    }
  });

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // ─── Product search query ──────────────────────────────────────

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ["products", "billing-search", searchQuery],
    queryFn: () => productsApi.list({ search: searchQuery, isActive: true, limit: 24 }),
    enabled: searchQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const searchResults = searchData?.products ?? [];

  // Query in-stock units for dialog
  const { data: availableUnitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ["stock-units", "available", unitSelectProduct?.id],
    queryFn: () =>
      stockUnitsApi.list({
        productId: unitSelectProduct!.id,
        status: "IN_STOCK",
        limit: 50,
      }),
    enabled: !!unitSelectProduct,
  });

  const availableUnits = availableUnitsData?.units ?? [];

  // ─── Barcode scan mutation ─────────────────────────────────────

  const scanMutation = useMutation({
    mutationFn: (barcode: string) => {
      lastScannedCodeRef.current = barcode;
      return productsApi.scan(barcode);
    },
    onSuccess: (product) => {
      const added = addScannedProductToCart(product);
      if (added) {
        setBarcodeInput("");
        playBeep("success");
      }
    },
    onError: (err) => {
      playBeep("error");
      const code = lastScannedCodeRef.current;
      setUnknownBarcode(code);
      setShowUnknownDialog(true);
      toast.error(getErrorMessage(err));
    },
    onSettled: () => setIsScanning(false),
  });

  // ─── Sale creation mutation ────────────────────────────────────

  const saleMutation = useMutation({
    mutationFn: ({
      payload,
      key,
    }: {
      payload: Parameters<typeof salesApi.create>[0];
      key: string;
    }) => salesApi.create(payload, key),
    onSuccess: (sale) => {
      playBeep("success");
      setCompletedSale(sale);
      setCart([]);
      setConfirmOpen(false);
      setMobileTab("catalog");
      if (autoPrint && typeof window !== "undefined") {
        window.open(`/sales/${sale.id}/print`, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-units"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`Invoice ${sale.invoiceNumber} created!`);
    },
    onError: (err) => {
      playBeep("error");
      setConfirmOpen(false);
      toast.error(getErrorMessage(err));
    },
  });

  // ─── Cart helpers ─────────────────────────────────────────────

  // Add specific stock unit
  const addStockUnitToCart = useCallback(
    (product: Product, unit: StockUnit) => {
      setCompletedSale(null);
      // Check if unit is already in cart
      const existing = cart.find((l) => l.stockUnit?.id === unit.id);
      if (existing) {
        toast.warning(`Unit with IMEI ${unit.imei1} is already in the cart!`);
        playBeep("error");
        return false;
      }

      const price = Number(
        unit.sellingPrice ?? product.defaultSellingPrice ?? product.purchaseCost ?? 0,
      );
      setCart((prev) => [
        ...prev,
        {
          lineId: unit.id,
          product,
          qty: 1,
          unitPrice: price,
          stockUnit: unit,
          imei: unit.imei1,
          imei2: unit.imei2 ?? undefined,
          chargerNo: unit.chargerNo ?? undefined,
          serialNumber: unit.imei1,
        },
      ]);
      toast.success(`Added ${product.name} (IMEI: ${unit.imei1})`);
      return true;
    },
    [cart],
  );

  // Add from scan
  const addScannedProductToCart = useCallback(
    (product: Product): boolean => {
      setCompletedSale(null);
      if (product.scannedUnit) {
        return addStockUnitToCart(product, product.scannedUnit);
      }

      // If product tracks serial but no specific unit resolved
      if (product.trackSerial) {
        setUnitSelectProduct(product);
        return true;
      }

      // Regular non-serialized product
      const inventoryQty = product.inventory?.quantity ?? 0;
      if (inventoryQty <= 0) {
        toast.error(`"${product.name}" is out of stock!`);
        playBeep("error");
        return false;
      }

      let canAdd = true;
      setCart((prev) => {
        const exists = prev.find((l) => l.product.id === product.id && !l.stockUnit);
        if (exists) {
          if (exists.qty >= inventoryQty) {
            toast.warning(`Max available stock is ${inventoryQty} units.`);
            playBeep("error");
            canAdd = false;
            return prev;
          }
          return prev.map((l) => (l.lineId === exists.lineId ? { ...l, qty: l.qty + 1 } : l));
        }
        return [
          ...prev,
          {
            lineId: product.id,
            product,
            qty: 1,
            unitPrice: Number(product.defaultSellingPrice ?? product.purchaseCost ?? 0),
            serialNumber: "",
          },
        ];
      });
      toast.success(`${product.name} added to cart`);
      return canAdd;
    },
    [addStockUnitToCart],
  );

  // Handle clicking product in search catalog
  const handleProductClick = (product: Product) => {
    if (product.trackSerial) {
      setUnitSelectProduct(product);
    } else {
      addScannedProductToCart(product);
    }
  };

  const updateLine = (lineId: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));

  const removeLine = (lineId: string) => setCart((prev) => prev.filter((l) => l.lineId !== lineId));

  // ─── Barcode scan handler ──────────────────────────────────────

  const handlePerformScan = (codeToScan?: string) => {
    const code = (codeToScan ?? barcodeInput).trim();
    if (!code) return;
    setIsScanning(true);
    scanMutation.mutate(code);
  };

  const handleScan = () => handlePerformScan();

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleScan();
  };

  // ─── Inclusive GST Totals ──────────────────────────────────────

  const grossTotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  // Ex-GST base and GST calculation for each line
  const linesBreakdown = cart.map((l) => {
    const rate = l.product.taxCategory?.rate ?? 0;
    const lineGross = l.qty * l.unitPrice;
    const lineBase = Number((lineGross / (1 + rate / 100)).toFixed(2));
    const lineTax = Number((lineGross - lineBase).toFixed(2));
    return {
      name: l.product.taxCategory?.name || (rate > 0 ? `GST ${rate}%` : "Zero Tax"),
      rate,
      gross: lineGross,
      base: lineBase,
      tax: lineTax,
    };
  });

  const taxableBase = linesBreakdown.reduce((s, b) => s + b.base, 0);
  const totalTax = linesBreakdown.reduce((s, b) => s + b.tax, 0);

  const isIntraState = (customerStateCode.trim() || "20") === (activeShop?.stateCode || "20");
  const cgst = isIntraState ? Number((totalTax / 2).toFixed(2)) : 0;
  const sgst = isIntraState ? Number((totalTax - cgst).toFixed(2)) : 0;
  const igst = !isIntraState ? totalTax : 0;

  // ─── Complete sale handler ────────────────────────────────────

  const handleCompleteSale = () => {
    const key = crypto.randomUUID();
    const payload = {
      items: cart.map((l) => {
        const unitSellingPrice = Number(l.unitPrice);
        const defaultPrice = Number(
          l.stockUnit?.sellingPrice ?? l.product.defaultSellingPrice ?? l.product.purchaseCost ?? 0,
        );
        const discountAmount =
          defaultPrice > unitSellingPrice
            ? Number((defaultPrice - unitSellingPrice).toFixed(2))
            : 0;

        return {
          productId: l.product.id,
          stockUnitId: l.stockUnit?.id,
          imei: l.imei,
          imei2: l.imei2,
          chargerNo: l.chargerNo,
          quantity: Math.max(1, Math.floor(Number(l.qty))),
          unitSellingPrice: Number(unitSellingPrice.toFixed(2)),
          discountAmount,
          serialNumber: l.imei || l.serialNumber?.trim() || undefined,
        };
      }),
      paymentMethod,
      paymentReference: paymentRef.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerGstin: customerGstin.trim().toUpperCase() || undefined,
      customerAadhaar: customerAadhaar.trim() || undefined,
      customerState: customerState.trim() || "Jharkhand",
      customerStateCode: customerStateCode.trim() || "20",
      placeOfSupply: placeOfSupply.trim() || customerState.trim() || "Jharkhand",
      paymentMode: paymentMethod,
      notes:
        [
          [
            "Bajaj Finserv",
            "DMI Finance",
            "Home Credit",
            "TVS Credit",
            "Chola",
            "IDFC FIRST Bank",
          ].includes(paymentMethod)
            ? `Finance: ${paymentMethod}${paymentRef ? ` (Ref: ${paymentRef.trim()})` : ""}`
            : null,
          [
            "Bajaj Finserv",
            "DMI Finance",
            "Home Credit",
            "TVS Credit",
            "Chola",
            "IDFC FIRST Bank",
          ].includes(paymentMethod)
            ? "Emi कटने के तारीख से 3 दिन पहले A/c में पैसा डाल के रखना अनिवार्य है"
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
    };

    saleMutation.mutate({ payload, key });
  };

  const startNewBill = () => {
    setCompletedSale(null);
    setCart([]);
    setSearchQuery("");
    setBarcodeInput("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerGstin("");
    setCustomerAadhaar("");
    setPaymentMethod("Cash");
    setPaymentRef("");
    setMobileTab("catalog");
  };

  // ─── Success state ────────────────────────────────────────────

  if (completedSale) {
    return (
      <AppShell title="New Bill">
        <PageHeader title="New Bill" />
        <div className="panel success-state" style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <CheckCircle2
            size={56}
            style={{ margin: "0 auto 1rem", color: "var(--color-success, #16a34a)" }}
          />
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Sale Complete!
          </h2>
          <p style={{ marginBottom: "0.25rem", fontWeight: 600, fontSize: "1.1rem" }}>
            Invoice #{completedSale.invoiceNumber}
          </p>
          <p style={{ marginBottom: "0.25rem" }}>
            {money(completedSale.totalAmount)} · {paymentMethod}
          </p>
          <p className="sample-caption" style={{ marginBottom: "2rem" }}>
            Payment recorded · Inventory deducted · IMEI status marked SOLD
          </p>
          <div className="flex justify-center gap-3" style={{ flexWrap: "wrap" }}>
            <Button onClick={startNewBill} variant="default">
              <Plus />
              New Bill
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              <a
                href={`/sales/${completedSale.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Printer size={15} className="mr-1.5" />
                Print Bill (A4 / Thermal)
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link to="/sales/$id" params={{ id: completedSale.id }}>
                <Receipt size={15} className="mr-1.5" />
                View Invoice
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/sales">Sales History</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Main billing UI ──────────────────────────────────────────

  return (
    <AppShell title="New Bill">
      <PageHeader
        title="New Bill"
        subtitle="Search phone models or scan IMEI barcodes to add units to the bill."
      />

      {/* ── Mobile Tab Switcher ── */}
      <div className="mobile-pos-switcher">
        <button
          type="button"
          className={`mobile-pos-tab ${mobileTab === "catalog" ? "active" : ""}`}
          onClick={() => setMobileTab("catalog")}
        >
          <Search size={16} />
          <span>Products &amp; Scan</span>
        </button>
        <button
          type="button"
          className={`mobile-pos-tab ${mobileTab === "cart" ? "active" : ""}`}
          onClick={() => setMobileTab("cart")}
        >
          <ShoppingBag size={16} />
          <span>Bill</span>
          {cart.length > 0 && (
            <span className="mobile-cart-badge">{cart.reduce((s, l) => s + l.qty, 0)}</span>
          )}
        </button>
      </div>

      <div className="pos-grid">
        {/* ── Left: Product search & scan ── */}
        <section
          className={`pos-catalog-section ${mobileTab === "cart" ? "mobile-hidden-on-small" : ""}`}
        >
          {/* Barcode scan row */}
          <div className="barcode-row" style={{ marginBottom: "0.75rem" }}>
            <div className="search-input" style={{ flex: 1 }}>
              <ScanLine size={18} />
              <Input
                ref={barcodeRef}
                aria-label="Scan barcode or IMEI"
                placeholder="Scan IMEI, barcode, or use USB scanner…"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                disabled={isScanning}
                className="font-mono"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={!barcodeInput.trim() || isScanning}
              aria-label="Lookup barcode"
            >
              <ScanLine size={16} className="mr-1" />
              {isScanning ? "Looking up…" : "Lookup"}
            </Button>
            <Button
              onClick={() => setScannerOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              aria-label="Scan product with camera"
            >
              <Camera size={16} className="mr-1.5" />
              <span>Camera</span>
            </Button>
          </div>

          {/* Product search */}
          <div className="search-input" style={{ marginBottom: "1rem" }}>
            <Search size={18} />
            <Input
              aria-label="Search products"
              placeholder="Search phone model, variant, color (e.g. Oppo A6x, 4/64)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Product grid */}
          {searchQuery.trim() ? (
            isSearching ? (
              <div className="sample-caption" style={{ padding: "2rem", textAlign: "center" }}>
                Searching models…
              </div>
            ) : searchResults.length > 0 ? (
              <div className="pos-product-grid">
                {searchResults.map((p) => {
                  const qty = p.trackSerial
                    ? (p.inStockCount ?? p.inventory?.quantity ?? 0)
                    : (p.inventory?.quantity ?? 0);
                  const primaryImage = p.images.find((i) => i.isPrimary)?.url ?? p.images[0]?.url;

                  return (
                    <div className="pos-product" key={p.id}>
                      {primaryImage ? (
                        <img src={primaryImage} alt={p.name} width={512} height={512} />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            background: "var(--color-muted, #f3f4f6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "0.5rem",
                          }}
                        >
                          <ShoppingBag size={32} style={{ opacity: 0.3 }} />
                        </div>
                      )}
                      <h3>{p.name}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground my-1">
                        {p.variant && (
                          <span className="px-1.5 py-0.5 rounded bg-muted font-medium text-foreground">
                            {p.variant}
                          </span>
                        )}
                        {p.color && (
                          <span className="px-1.5 py-0.5 rounded bg-muted font-medium text-foreground">
                            {p.color}
                          </span>
                        )}
                        {p.trackSerial && (
                          <span className="text-emerald-700 font-medium">IMEI Tracked</span>
                        )}
                      </div>
                      <p className="text-xs">
                        {qty} unit{qty !== 1 ? "s" : ""} available
                      </p>
                      <div className="pos-product-footer mt-2">
                        <strong>{money(p.defaultSellingPrice ?? p.purchaseCost)}</strong>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={qty === 0}
                          aria-label={`Add ${p.name}`}
                          onClick={() => handleProductClick(p)}
                        >
                          <Plus size={14} />
                          {qty === 0 ? "Out of stock" : p.trackSerial ? "Select Unit" : "Add"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No matching products"
                detail="Try a different search term or scan an IMEI barcode."
              />
            )
          ) : (
            <div className="sample-caption" style={{ padding: "2rem", textAlign: "center" }}>
              Type to search phone models, or scan an IMEI / barcode above.
            </div>
          )}
        </section>

        {/* ── Right: Cart panel ── */}
        <section
          className={`panel cart-panel pos-cart-section ${mobileTab === "catalog" ? "mobile-hidden-on-small" : ""}`}
        >
          <div className="panel-header">
            <h2>Current Bill</h2>
            <span className="sample-caption">{cart.reduce((s, l) => s + l.qty, 0)} items</span>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCart([])}
                aria-label="Clear cart"
                style={{ marginLeft: "auto" }}
              >
                <RotateCcw size={14} />
                Clear
              </Button>
            )}
          </div>

          <div className="panel-body">
            {cart.length > 0 && (
              <div className="mobile-only-add-more mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setMobileTab("catalog")}
                >
                  <Plus size={15} className="mr-1" />
                  Add More Products
                </Button>
              </div>
            )}

            {cart.length ? (
              <div className="space-y-3">
                {cart.map((l) => {
                  const lineTotal = l.qty * l.unitPrice;
                  const purchaseCost = l.stockUnit?.purchaseCost ?? l.product.purchaseCost;
                  const isBelowCost = l.unitPrice < purchaseCost;

                  return (
                    <div className="cart-item border rounded-lg p-3 bg-card" key={l.lineId}>
                      <div className="cart-item-title flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{l.product.name}</h3>
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                            {l.product.variant && <span>{l.product.variant}</span>}
                            {l.product.color && <span>· {l.product.color}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          aria-label={`Remove ${l.product.name}`}
                          onClick={() => removeLine(l.lineId)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>

                      {/* Serialized IMEI badge */}
                      {l.imei && (
                        <div className="mt-1.5 mb-2 flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            IMEI: {l.imei}
                          </span>
                          {l.imei2 && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              IMEI 2: {l.imei2}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="cart-controls flex items-center gap-2 mt-2">
                        {l.stockUnit ? (
                          <span className="text-xs text-muted-foreground font-semibold px-2.5 py-1 rounded bg-muted/60">
                            1 unit (Locked)
                          </span>
                        ) : (
                          <QuantityStepper
                            value={l.qty}
                            onChange={(qty) =>
                              updateLine(l.lineId, {
                                qty: Math.min(qty, l.product.inventory?.quantity ?? 999),
                              })
                            }
                          />
                        )}

                        <div className="flex flex-col gap-0.5">
                          <Input
                            aria-label={`Selling price for ${l.product.name}`}
                            type="number"
                            min={0}
                            step={0.01}
                            value={l.unitPrice}
                            style={{ width: "6.5rem" }}
                            className="h-8 text-xs font-semibold"
                            onChange={(e) =>
                              updateLine(l.lineId, {
                                unitPrice: Math.max(0, Number(e.target.value)),
                              })
                            }
                          />
                          <span className="text-[10px] text-muted-foreground">Incl. GST</span>
                        </div>

                        <span className="ml-auto text-xs font-bold text-foreground">
                          {money(lineTotal)}
                        </span>
                      </div>

                      {/* Optional Charger / Serial input */}
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {l.stockUnit ? (
                          <Input
                            aria-label="Charger serial number"
                            placeholder="Charger no. (optional)"
                            value={l.chargerNo ?? ""}
                            onChange={(e) => updateLine(l.lineId, { chargerNo: e.target.value })}
                            className="h-7 text-[11px] font-mono"
                          />
                        ) : (
                          <Input
                            aria-label="Serial number"
                            placeholder="Serial / Notes (optional)"
                            value={l.serialNumber ?? ""}
                            onChange={(e) => updateLine(l.lineId, { serialNumber: e.target.value })}
                            className="h-7 text-[11px] font-mono"
                          />
                        )}
                      </div>

                      {isBelowCost && (
                        <div
                          className="warning-text mt-1.5 flex items-center gap-1 text-[11px] text-destructive"
                          role="alert"
                        >
                          <AlertTriangle size={12} />
                          Below cost ({money(purchaseCost)})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Cart is empty"
                detail="Search for a model or scan an IMEI to add items."
              />
            )}

            {/* ── Customer Details ── */}
            <div className="mt-5 space-y-2.5 border-t pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Customer &amp; Tax Information
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Customer name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Mobile number *"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Input
                placeholder="Customer address (e.g. Bishnugarh, Hazaribagh)"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Customer GSTIN (optional)"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  className="h-8 text-xs font-mono"
                  maxLength={15}
                />
                <Input
                  placeholder="Aadhaar Last 4 Digits (optional)"
                  value={customerAadhaar}
                  onChange={(e) =>
                    setCustomerAadhaar(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  className="h-8 text-xs font-mono"
                  maxLength={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="State"
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="State Code (20 for JH)"
                  value={customerStateCode}
                  onChange={(e) => setCustomerStateCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => {
                    setAutoPrint(e.target.checked);
                    try {
                      localStorage.setItem("time_centre_auto_print", String(e.target.checked));
                    } catch {
                      // ignore
                    }
                  }}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Auto-open print bill after sale</span>
              </label>
            </div>

            {/* ── Totals & payment ── */}
            <div className="mt-4 border-t pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-sm font-bold text-foreground">
                <span>Grand Total (Customer Pays)</span>
                <span className="text-emerald-700 dark:text-emerald-400">{money(grossTotal)}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Taxable Base Value (Ex-GST)</span>
                <span>{money(taxableBase)}</span>
              </div>

              {isIntraState ? (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Central GST (CGST)</span>
                    <span>{money(cgst)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>State GST (SGST)</span>
                    <span>{money(sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-muted-foreground">
                  <span>Integrated GST (IGST)</span>
                  <span>{money(igst)}</span>
                </div>
              )}

              <h3 className="text-xs pt-3 font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Method
              </h3>
              <div className="space-y-2 pt-1">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Regular Payment Modes:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["Cash", "UPI", "Card", "Bank Transfer"] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={paymentMethod === m ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => setPaymentMethod(m)}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    EMI / Finance Providers:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        "Bajaj Finserv",
                        "DMI Finance",
                        "Home Credit",
                        "TVS Credit",
                        "Chola",
                        "IDFC FIRST Bank",
                      ] as const
                    ).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={paymentMethod === m ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-xs px-2.5 font-medium ${
                          paymentMethod === m
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        }`}
                        onClick={() => setPaymentMethod(m)}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>

                {[
                  "Bajaj Finserv",
                  "DMI Finance",
                  "Home Credit",
                  "TVS Credit",
                  "Chola",
                  "IDFC FIRST Bank",
                ].includes(paymentMethod) && (
                  <div className="pt-1 space-y-1.5 bg-emerald-50/60 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 shrink-0">
                        Loan / App Ref:
                      </label>
                      <Input
                        placeholder="e.g. Agreement ID, Approval No., Loan ID"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        className="h-7 text-xs bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/60 p-1.5 rounded border border-amber-300 dark:border-amber-800">
                      📌 EMI Note: Emi कटने के तारीख से 3 दिन पहले A/c में पैसा डाल के रखना अनिवार्य
                      है
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                size="lg"
                disabled={!cart.length || saleMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <ShoppingBag size={18} className="mr-2" />
                Complete Sale · {money(grossTotal)}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Floating cart peek on mobile */}
      {cart.length > 0 && mobileTab === "catalog" && (
        <div className="mobile-cart-peek">
          <div className="mobile-cart-peek-info">
            <span className="mobile-cart-peek-count">
              {cart.reduce((s, l) => s + l.qty, 0)} item{cart.length !== 1 ? "s" : ""}
            </span>
            <span className="mobile-cart-peek-total">{money(grossTotal)}</span>
          </div>
          <Button
            size="sm"
            className="mobile-cart-peek-btn bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setMobileTab("cart")}
          >
            <ShoppingBag size={14} className="mr-1.5" />
            View Bill ({money(grossTotal)})
          </Button>
        </div>
      )}

      {/* ── Serialized Unit Selection Dialog ── */}
      <Dialog open={!!unitSelectProduct} onOpenChange={(o) => !o && setUnitSelectProduct(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogTitle>Select Physical Unit (IMEI)</DialogTitle>
          <DialogDescription>
            {unitSelectProduct?.name} ({availableUnits.length} in stock). Choose an IMEI or
            auto-pick oldest.
          </DialogDescription>

          <div className="py-2 space-y-3">
            {/* Auto-pick button */}
            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              disabled={availableUnits.length === 0}
              onClick={() => {
                if (availableUnits[0] && unitSelectProduct) {
                  addStockUnitToCart(unitSelectProduct, availableUnits[0]);
                  setUnitSelectProduct(null);
                }
              }}
            >
              <Boxes size={15} className="mr-1.5" /> Auto-pick Oldest In-Stock Unit
            </Button>

            <div className="border-t pt-2">
              <span className="text-xs font-semibold text-muted-foreground block mb-2">
                Or Select Specific IMEI:
              </span>
              {loadingUnits ? (
                <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
                  Loading available units…
                </div>
              ) : availableUnits.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border rounded-lg">
                  No serialized units currently in stock for this model.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y">
                  {availableUnits.map((u) => {
                    const alreadyInCart = cart.some((l) => l.stockUnit?.id === u.id);
                    return (
                      <div
                        key={u.id}
                        className={`p-2 rounded border flex justify-between items-center text-xs ${
                          alreadyInCart
                            ? "opacity-50 cursor-not-allowed bg-muted/40"
                            : "hover:bg-muted/50 cursor-pointer"
                        }`}
                        onClick={() => {
                          if (!alreadyInCart && unitSelectProduct) {
                            addStockUnitToCart(unitSelectProduct, u);
                            setUnitSelectProduct(null);
                          }
                        }}
                      >
                        <div>
                          <div className="font-mono font-semibold text-foreground">{u.imei1}</div>
                          {u.imei2 && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {u.imei2}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-emerald-600 block">
                            {u.sellingPrice ? money(Number(u.sellingPrice)) : "Default Price"}
                          </span>
                          {alreadyInCart && (
                            <span className="text-[10px] text-muted-foreground">In Cart</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="dialog-actions flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setUnitSelectProduct(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Complete GST Sale?</DialogTitle>
          <DialogDescription>
            {cart.length} item{cart.length !== 1 ? "s" : ""} · {money(grossTotal)} via{" "}
            {paymentMethod}.
            <br />
            IMEIs will be marked SOLD and GST invoice will be generated.
          </DialogDescription>
          <div className="my-2 max-h-48 overflow-y-auto divide-y text-xs">
            {cart.map((l) => (
              <div key={l.lineId} className="py-1.5 flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {l.product.name} × {l.qty}
                  </div>
                  {l.imei && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      IMEI: {l.imei}
                    </div>
                  )}
                </div>
                <span className="font-semibold">{money(l.qty * l.unitPrice)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between font-bold text-foreground">
              <span>Invoice Total:</span>
              <span>{money(grossTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{customerName || "Walk-in Customer"}</span>
            </div>
            {customerPhone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{customerPhone}</span>
              </div>
            )}
          </div>

          <div className="dialog-actions mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={saleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteSale}
              disabled={saleMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {saleMutation.isPending ? "Generating Invoice…" : `Confirm · ${money(grossTotal)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Unknown Barcode Dialog ── */}
      <Dialog open={showUnknownDialog} onOpenChange={setShowUnknownDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={20} /> Unregistered Barcode / IMEI
          </DialogTitle>
          <DialogDescription>
            No product or serialized unit in this shop matches:
            <span className="block mt-1 font-mono font-semibold text-foreground text-base bg-muted/60 p-2 rounded">
              {unknownBarcode}
            </span>
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-2">
            Would you like to register this phone model or receive stock for it?
          </p>
          <div className="dialog-actions mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUnknownDialog(false)}>
              Cancel
            </Button>
            <Button
              asChild
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowUnknownDialog(false)}
            >
              <Link to="/products/new">
                <Plus size={16} className="mr-1" /> Register Model
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Barcode Scanner Camera Dialog ── */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(result) => {
          setScannerOpen(false);
          handlePerformScan(result.barcode);
        }}
        title="Scan IMEI to Bill"
        description="Position phone box IMEI barcode within viewfinder."
      />
    </AppShell>
  );
}
