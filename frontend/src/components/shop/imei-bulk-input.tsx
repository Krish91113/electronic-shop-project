import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ScanLine,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BarcodeScanner } from "./barcode-scanner";
import {
  stockUnits as stockUnitsApi,
  getErrorMessage,
  type StockUnitPreviewResult,
  type ReceiveStockUnitsData,
} from "@/lib/api";

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export interface ImeiBulkInputProps {
  productId: string;
  productName: string;
  defaultPurchaseCost?: number | undefined;
  defaultSellingPrice?: number | null | undefined;
  onSuccess?: ((count: number) => void) | undefined;
  onCancel?: (() => void) | undefined;
}

export function ImeiBulkInput({
  productId,
  productName,
  defaultPurchaseCost = 0,
  defaultSellingPrice,
  onSuccess,
  onCancel,
}: ImeiBulkInputProps) {
  const [rawText, setRawText] = useState("");
  const [singleInput, setSingleInput] = useState("");
  const [supplier, setSupplier] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [batchCost, setBatchCost] = useState(defaultPurchaseCost);
  const [batchPrice, setBatchPrice] = useState<number | undefined>(
    defaultSellingPrice ?? undefined,
  );
  const [allowInvalidLuhn, setAllowInvalidLuhn] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [preview, setPreview] = useState<StockUnitPreviewResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract clean IMEI list from rawText
  const parsedImeis = rawText
    .split(/[\r\n,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Debounced preview check
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (parsedImeis.length === 0) {
      setPreview(null);
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const unitsToPreview = parsedImeis.map((imei) => ({
          imei1: imei,
          purchaseCost: Number(batchCost) || 0,
          sellingPrice: batchPrice != null ? Number(batchPrice) : undefined,
          allowLuhnOverride: allowInvalidLuhn,
        }));
        const res = await stockUnitsApi.preview(unitsToPreview);
        setPreview(res);
      } catch (err) {
        console.error("IMEI preview error", err);
      } finally {
        setIsPreviewing(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [rawText, batchCost, batchPrice, allowInvalidLuhn]);

  const handleAddSingle = () => {
    const val = singleInput.trim();
    if (!val) return;
    setRawText((prev) => (prev ? `${prev}\n${val}` : val));
    setSingleInput("");
  };

  const handleScan = (scanned: string) => {
    const code = scanned.trim();
    if (!code) return;
    setRawText((prev) => (prev ? `${prev}\n${code}` : code));
    toast.success(`Scanned: ${code}`);
  };

  const handleSubmit = async () => {
    const validUnits = preview?.valid ?? [];
    if (validUnits.length === 0) {
      toast.error("No valid stock units to receive. Please check the IMEI numbers.");
      return;
    }
    if (
      (preview?.duplicatesInBatch?.length ?? 0) > 0 ||
      (preview?.alreadyInShop?.length ?? 0) > 0
    ) {
      toast.warning("Duplicate IMEIs were detected and will be skipped.");
    }

    setIsSubmitting(true);
    try {
      const payload: ReceiveStockUnitsData = {
        productId,
        supplier: supplier.trim() || undefined,
        purchaseRef: purchaseRef.trim() || undefined,
        purchaseCost: Number(batchCost) || 0,
        sellingPrice: batchPrice != null ? Number(batchPrice) : undefined,
        units: validUnits.map((u) => ({
          imei1: u.imei1,
          imei2: u.imei2 || undefined,
          purchaseCost: u.purchaseCost ?? batchCost,
          sellingPrice: u.sellingPrice ?? batchPrice,
          allowLuhnOverride: allowInvalidLuhn,
        })),
      };

      const result = await stockUnitsApi.receive(payload);
      toast.success(
        `Successfully received ${result.receivedCount} stock unit(s) for ${productName}!`,
      );
      if (onSuccess) onSuccess(result.receivedCount);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top fields: Supplier, Invoice Ref, Cost, Selling Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Supplier / Vendor
          </label>
          <Input
            placeholder="e.g. Balaji Distributor"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Supplier Bill / Invoice No.
          </label>
          <Input
            placeholder="e.g. INV-2026-99"
            value={purchaseRef}
            onChange={(e) => setPurchaseRef(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Purchase Cost / Unit (₹)
          </label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={batchCost}
            onChange={(e) => setBatchCost(Math.max(0, Number(e.target.value)))}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Selling Price / Unit (₹ Incl. GST)
          </label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={batchPrice ?? ""}
            placeholder="Optional override"
            onChange={(e) =>
              setBatchPrice(e.target.value ? Math.max(0, Number(e.target.value)) : undefined)
            }
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Input area: Quick scan / single input & Camera button */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            placeholder="Scan IMEI with barcode reader or type and press Enter…"
            value={singleInput}
            onChange={(e) => setSingleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSingle();
              }
            }}
            className="h-9 text-xs font-mono"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddSingle}
          disabled={!singleInput.trim()}
        >
          <Plus size={14} className="mr-1" /> Add
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setScannerOpen(true)}
        >
          <Camera size={14} className="mr-1" /> Scan Camera
        </Button>
      </div>

      {/* Multiline textarea for batch paste */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-semibold text-muted-foreground">
            IMEI Numbers (paste lines, commas, or spaces)
          </label>
          {rawText && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              onClick={() => setRawText("")}
            >
              <RotateCcw size={12} /> Clear all
            </button>
          )}
        </div>
        <Textarea
          rows={5}
          placeholder="Paste or scan IMEIs here:
865796081668730
865796081696319
865796081696327"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="font-mono text-xs leading-relaxed"
        />
      </div>

      {/* Live validation summary badges */}
      {parsedImeis.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">
              Total Entered: {parsedImeis.length}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
              <CheckCircle2 size={12} /> Valid:{" "}
              {preview?.summary?.validCount ?? preview?.valid?.length ?? 0}
            </span>
            {(preview?.summary?.invalidCount ?? preview?.invalid?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                <AlertTriangle size={12} /> Invalid Format:{" "}
                {preview?.summary?.invalidCount ?? preview?.invalid?.length}
              </span>
            )}
            {(preview?.summary?.alreadyInShopCount ?? preview?.alreadyInShop?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium">
                <AlertCircle size={12} /> Shop Duplicates:{" "}
                {preview?.summary?.alreadyInShopCount ?? preview?.alreadyInShop?.length}
              </span>
            )}
            {(preview?.summary?.duplicateCount ?? preview?.duplicatesInBatch?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                <AlertCircle size={12} /> In-Batch Duplicates:{" "}
                {preview?.summary?.duplicateCount ?? preview?.duplicatesInBatch?.length}
              </span>
            )}
            {isPreviewing && (
              <span className="text-muted-foreground animate-pulse text-[11px]">Validating…</span>
            )}
          </div>

          {/* If there are format or invalid items, show reasons */}
          {preview?.invalid && preview.invalid.length > 0 && (
            <div className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 p-2 rounded space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertTriangle size={12} /> Format Warnings:
              </div>
              {preview.invalid.map((inv, idx) => (
                <div key={idx} className="font-mono text-[10px]">
                  • <span className="font-semibold">{inv.imei1}</span>: {inv.reason}
                </div>
              ))}
            </div>
          )}

          {/* Checkbox to allow non-standard/unverified IMEIs if there are format issues */}
          {((preview?.summary?.invalidCount ?? preview?.invalid?.length ?? 0) > 0 ||
            allowInvalidLuhn) && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <input
                type="checkbox"
                id="allowLuhn"
                checked={allowInvalidLuhn}
                onChange={(e) => setAllowInvalidLuhn(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label
                htmlFor="allowLuhn"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                Allow non-standard / bypass checksum check (accepts 6–20 digit serials)
              </label>
            </div>
          )}

          {preview?.alreadyInShop && preview.alreadyInShop.length > 0 && (
            <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded space-y-1">
              <div className="font-semibold">Already in shop inventory:</div>
              {preview.alreadyInShop.map((item, idx) => (
                <div key={idx} className="font-mono text-[10px]">
                  • {item.imei1} ({item.reason})
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          disabled={!preview || (preview.valid?.length ?? 0) === 0 || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting
            ? "Receiving Units…"
            : `Receive ${preview?.valid?.length ?? 0} Unit${(preview?.valid?.length ?? 0) === 1 ? "" : "s"}`}
        </Button>
      </div>

      {/* Barcode scanner dialog */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(res) => {
          setScannerOpen(false);
          handleScan(res.barcode);
        }}
        title="Scan IMEI"
        description="Align phone packaging IMEI barcode with camera."
      />
    </div>
  );
}
