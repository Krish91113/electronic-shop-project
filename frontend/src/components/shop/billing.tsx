import { useState, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppShell, PageHeader, QuantityStepper, EmptyState, Field } from "./shared";
import {
  products as productsApi,
  sales as salesApi,
  type Product,
  type Sale,
  getErrorMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Types ───────────────────────────────────────────────────────

type CartLine = {
  product: Product;
  qty: number;
  unitPrice: number;
};

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// ─── BillingPage ─────────────────────────────────────────────────

export function BillingPage() {
  useAuth(); // ensure auth context present

  // Search / scan state
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Card" | "Other">("Cash");

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

  // ─── Barcode scan mutation ─────────────────────────────────────

  const scanMutation = useMutation({
    mutationFn: (barcode: string) => productsApi.scan(barcode),
    onSuccess: (product) => {
      addToCart(product);
      setBarcodeInput("");
      toast.success(`${product.name} added to cart`);
    },
    onError: (err) => {
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
      setCompletedSale(sale);
      setCart([]);
      setConfirmOpen(false);
      toast.success(`Invoice ${sale.invoiceNumber} created!`);
    },
    onError: (err) => {
      setConfirmOpen(false);
      toast.error(getErrorMessage(err));
    },
  });

  // ─── Cart helpers ─────────────────────────────────────────────

  const addToCart = useCallback((product: Product) => {
    setCompletedSale(null);
    setCart((prev) => {
      const exists = prev.find((l) => l.product.id === product.id);
      if (exists) {
        const inventoryQty = product.inventory?.quantity ?? 999;
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: Math.min(l.qty + 1, inventoryQty) } : l,
        );
      }
      return [
        ...prev,
        {
          product,
          qty: 1,
          unitPrice: product.defaultSellingPrice ?? product.purchaseCost,
        },
      ];
    });
  }, []);

  const updateLine = (id: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  // ─── Barcode scan handler ──────────────────────────────────────

  const handleScan = () => {
    const code = barcodeInput.trim();
    if (!code) return;
    setIsScanning(true);
    scanMutation.mutate(code);
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleScan();
  };

  // ─── Totals ───────────────────────────────────────────────────

  const subtotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  // Tax preview (reference only — final amounts computed by backend)
  const taxPreview = cart.reduce(
    (acc, l) => {
      const rate = l.product.taxCategory?.rate ?? 0;
      const name = l.product.taxCategory?.name ?? "Tax";
      const lineAmt = l.qty * l.unitPrice;
      const tax = (lineAmt * rate) / 100;
      if (rate === 0) return acc;
      const existing = acc.find((t) => t.name === name);
      if (existing) {
        existing.amount += tax;
      } else {
        acc.push({ name, rate, amount: tax });
      }
      return acc;
    },
    [] as { name: string; rate: number; amount: number }[],
  );

  const taxTotal = taxPreview.reduce((s, t) => s + t.amount, 0);
  const total = subtotal + taxTotal;

  // ─── Complete sale handler ────────────────────────────────────

  const handleCompleteSale = () => {
    const key = crypto.randomUUID();
    const payload = {
      items: cart.map((l) => ({
        productId: l.product.id,
        quantity: l.qty,
        unitSellingPrice: l.unitPrice,
        discountAmount:
          l.product.defaultSellingPrice && l.product.defaultSellingPrice > l.unitPrice
            ? l.product.defaultSellingPrice - l.unitPrice
            : 0,
      })),
      paymentMethod,
    };
    saleMutation.mutate({ payload, key });
  };

  const startNewBill = () => {
    setCompletedSale(null);
    setCart([]);
    setSearchQuery("");
    setBarcodeInput("");
    setPaymentMethod("Cash");
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
            Payment recorded · Inventory updated
          </p>
          <div className="flex justify-center gap-3" style={{ flexWrap: "wrap" }}>
            <Button onClick={startNewBill}>
              <Plus />
              New Bill
            </Button>
            <Button asChild variant="outline">
              <Link to="/sales/$id" params={{ id: completedSale.id }}>
                <Receipt />
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
        subtitle="Search for products or scan a barcode to add items to the bill."
      />

      <div className="pos-grid">
        {/* ── Left: Product search panel ── */}
        <section>
          {/* Barcode scan row */}
          <div className="barcode-row" style={{ marginBottom: "0.75rem" }}>
            <div className="search-input" style={{ flex: 1 }}>
              <ScanLine size={18} />
              <Input
                ref={barcodeRef}
                aria-label="Scan barcode"
                placeholder="Scan barcode or enter and press Enter…"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                disabled={isScanning}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={!barcodeInput.trim() || isScanning}
              aria-label="Scan product"
            >
              <ScanLine />
              {isScanning ? "Scanning…" : "Scan"}
            </Button>
          </div>

          {/* Product search */}
          <div className="search-input" style={{ marginBottom: "1rem" }}>
            <Search size={18} />
            <Input
              aria-label="Search products"
              placeholder="Search products by name, brand…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Product grid */}
          {searchQuery.trim() ? (
            isSearching ? (
              <div className="sample-caption" style={{ padding: "2rem", textAlign: "center" }}>
                Searching…
              </div>
            ) : searchResults.length > 0 ? (
              <div className="pos-product-grid">
                {searchResults.map((p) => {
                  const qty = p.inventory?.quantity ?? 0;
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
                      <p>
                        {p.barcode ?? p.id} · {qty} available
                      </p>
                      <div className="pos-product-footer">
                        <strong>{money(p.defaultSellingPrice ?? p.purchaseCost)}</strong>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={qty === 0}
                          aria-label={`Add ${p.name}`}
                          onClick={() => addToCart(p)}
                        >
                          <Plus />
                          {qty === 0 ? "Out of stock" : "Add"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No matching products"
                detail="Try a different search term or scan a barcode."
              />
            )
          ) : (
            <div className="sample-caption" style={{ padding: "2rem", textAlign: "center" }}>
              Type to search products, or scan a barcode above.
            </div>
          )}
        </section>

        {/* ── Right: Cart panel ── */}
        <section className="panel cart-panel">
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
            {cart.length ? (
              cart.map((l) => {
                const maxQty = l.product.inventory?.quantity ?? 999;
                const lineTotal = l.qty * l.unitPrice;
                const defaultPrice = l.product.defaultSellingPrice ?? l.product.purchaseCost;
                const isBelowCost = l.unitPrice < l.product.purchaseCost;

                return (
                  <div className="cart-item" key={l.product.id}>
                    <div className="cart-item-title">
                      <h3>{l.product.name}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${l.product.name}`}
                        onClick={() => removeLine(l.product.id)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>

                    <div className="cart-controls">
                      <QuantityStepper
                        value={l.qty}
                        onChange={(qty) => updateLine(l.product.id, { qty: Math.min(qty, maxQty) })}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <Input
                          aria-label={`Unit price for ${l.product.name}`}
                          type="number"
                          min={0}
                          step={0.01}
                          value={l.unitPrice}
                          style={{ width: "7rem" }}
                          onChange={(e) =>
                            updateLine(l.product.id, {
                              unitPrice: Math.max(0, Number(e.target.value)),
                            })
                          }
                        />
                        {l.unitPrice < defaultPrice && (
                          <span
                            style={{ fontSize: "0.65rem", color: "var(--color-muted-fg, #6b7280)" }}
                          >
                            Default: {money(defaultPrice)}
                          </span>
                        )}
                      </div>
                      <span className="ml-auto text-xs font-medium">{money(lineTotal)}</span>
                    </div>

                    {isBelowCost && (
                      <div
                        className="warning-text"
                        role="alert"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontSize: "0.75rem",
                          color: "#dc2626",
                          marginTop: "0.25rem",
                        }}
                      >
                        <AlertTriangle size={13} />
                        Below cost ({money(l.product.purchaseCost)})
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="Cart is empty"
                detail="Search for a product or scan a barcode to add items."
              />
            )}

            {/* ── Totals & payment ── */}
            <div className="mt-5">
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>

              {/* Tax breakdown (preview) */}
              {taxPreview.length > 0 && (
                <>
                  {taxPreview.map((t) => (
                    <div className="summary-row" key={t.name} style={{ fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--color-muted-fg, #6b7280)" }}>
                        {t.name} ({t.rate}%)
                      </span>
                      <span>≈ {money(t.amount)}</span>
                    </div>
                  ))}
                  <p className="sample-caption" style={{ fontSize: "0.7rem", marginTop: "0.2rem" }}>
                    Tax is a preview — final amounts computed by server
                  </p>
                </>
              )}

              <div className="summary-row summary-total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <h3 className="text-xs mt-6" style={{ marginBottom: "0.5rem", fontWeight: 600 }}>
                Payment Method
              </h3>
              <div className="payment-segments">
                {(["Cash", "UPI", "Card", "Other"] as const).map((m) => (
                  <Button
                    key={m}
                    variant={paymentMethod === m ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>

              <Button
                className="w-full complete-sale"
                size="lg"
                style={{ marginTop: "1rem" }}
                disabled={!cart.length || saleMutation.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <ShoppingBag />
                Complete Sale · {money(total)}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Confirmation dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Complete Sale?</DialogTitle>
          <DialogDescription>
            {cart.length} item{cart.length !== 1 ? "s" : ""} · {money(total)} via {paymentMethod}.
            <br />
            Inventory will be deducted and the invoice will be saved.
          </DialogDescription>
          <div style={{ margin: "0.5rem 0" }}>
            {cart.map((l) => (
              <div
                key={l.product.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                  padding: "0.2rem 0",
                }}
              >
                <span>
                  {l.product.name} × {l.qty}
                </span>
                <span>{money(l.qty * l.unitPrice)}</span>
              </div>
            ))}
          </div>
          <div className="dialog-actions">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={saleMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCompleteSale} disabled={saleMutation.isPending}>
              {saleMutation.isPending ? "Processing…" : `Confirm · ${money(total)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
