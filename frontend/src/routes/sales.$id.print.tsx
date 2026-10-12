import { useState, useEffect } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft, AlertCircle, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sales as salesApi, getErrorMessage, type SaleItem, type Payment } from "@/lib/api";

export const Route = createFileRoute("/sales/$id/print")({
  component: PrintableBillPage,
});

function fmt(n: number | string | undefined | null): string {
  const num = typeof n === "number" ? n : Number(n ?? 0);
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PrintableBillPage() {
  const { id } = useParams({ strict: false });
  const [layout, setLayout] = useState<"a4" | "thermal80">("a4");

  const {
    data: sale,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sale-invoice", id],
    queryFn: () => salesApi.invoice(id!),
    enabled: !!id,
  });

  // Calculate grouped tax breakdown
  const taxBreakdown = (sale?.items ?? []).reduce(
    (acc: { name: string; rate: number; amount: number }[], it: SaleItem) => {
      const rate = Number(it.taxRateSnapshot ?? 0);
      const name = it.taxCategorySnapshot || (rate > 0 ? `GST ${rate}%` : "Zero Tax");
      const amt = Number(it.taxAmount ?? 0);
      if (rate === 0 && amt === 0) return acc;
      const existing = acc.find(
        (x: { name: string; rate: number; amount: number }) => x.name === name,
      );
      if (existing) {
        existing.amount += amt;
      } else {
        acc.push({ name, rate, amount: amt });
      }
      return acc;
    },
    [] as { name: string; rate: number; amount: number }[],
  );

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 print:bg-white print:p-0">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-bill-root {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .layout-a4 {
            width: 100% !important;
            max-width: 100% !important;
          }
          .layout-thermal80 {
            width: 78mm !important;
            max-width: 78mm !important;
            font-size: 11px !important;
            padding: 2mm !important;
          }
          @page {
            size: auto;
            margin: 6mm;
          }
        }
      `}</style>

      {/* Screen toolbar (hidden during print) */}
      <div className="no-print mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/sales/$id" params={{ id: id! }}>
              <ArrowLeft size={14} className="mr-1.5" />
              Back to Invoice
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">|</span>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                layout === "a4"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setLayout("a4")}
            >
              <FileText size={13} className="mr-1 inline" />
              A4 Standard
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                layout === "thermal80"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              onClick={() => setLayout("thermal80")}
            >
              <Receipt size={13} className="mr-1 inline" />
              80mm Thermal
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <Printer size={15} className="mr-1.5" />
            Print Bill
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="mx-auto max-w-2xl rounded-xl border bg-white p-12 text-center text-slate-500">
          Loading printable bill…
        </div>
      ) : isError || !sale ? (
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
          <AlertCircle size={36} className="mx-auto mb-2 text-red-500" />
          <h3 className="font-semibold text-slate-900">Failed to load bill</h3>
          <p className="text-sm text-slate-600 mt-1">{getErrorMessage(error)}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        /* The printable bill paper */
        <div
          className={`print-bill-root mx-auto rounded-lg border border-slate-200 bg-white text-slate-900 shadow-md ${
            layout === "thermal80"
              ? "layout-thermal80 max-w-[340px] p-4 text-[12px] font-mono leading-tight"
              : "layout-a4 max-w-3xl p-8 sm:p-10 font-sans"
          }`}
        >
          {/* Cancelled Alert / Stamp */}
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

          {/* Header */}
          <div
            className={`border-b pb-4 ${layout === "thermal80" ? "text-center border-dashed" : "flex justify-between items-start"}`}
          >
            <div>
              {sale.shop?.logoUrl && (
                <img
                  src={sale.shop.logoUrl}
                  alt={sale.shop?.name}
                  className={`object-contain ${layout === "thermal80" ? "mx-auto mb-2 h-10" : "mb-3 h-12"}`}
                />
              )}
              <h1
                className={`font-bold tracking-tight text-slate-900 ${layout === "thermal80" ? "text-base uppercase" : "text-2xl"}`}
              >
                {sale.shop?.name ?? "Time Centre Mobile & Electronics"}
              </h1>
              {sale.shop?.address && (
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{sale.shop.address}</p>
              )}
              <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 justify-center sm:justify-start">
                {sale.shop?.contactPhone && <span>Tel: {sale.shop.contactPhone}</span>}
                {sale.shop?.contactEmail && <span>Email: {sale.shop.contactEmail}</span>}
              </div>
              {sale.shop?.gstin && (
                <p className="text-xs font-semibold text-slate-900 mt-1">
                  GSTIN: {sale.shop.gstin}
                </p>
              )}
            </div>

            <div
              className={layout === "thermal80" ? "mt-3 pt-2 border-t border-dashed" : "text-right"}
            >
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Retail Tax Invoice
              </div>
              <div className="font-mono text-sm font-bold text-slate-900 sm:text-base">
                {sale.invoiceNumber}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">{formatDate(sale.createdAt)}</div>
              {sale.payments?.[0]?.method && (
                <div className="text-xs font-medium text-slate-700 mt-0.5">
                  Mode: {sale.payments[0].method}
                </div>
              )}
            </div>
          </div>

          {/* Customer info */}
          {(sale.customerName || sale.customerPhone) && (
            <div
              className={`py-3 border-b ${layout === "thermal80" ? "border-dashed text-xs" : "text-sm"}`}
            >
              <span className="font-bold text-slate-700">Customer Details: </span>
              {sale.customerName && (
                <span className="font-semibold text-slate-900">{sale.customerName}</span>
              )}
              {sale.customerName && sale.customerPhone && (
                <span className="text-slate-400"> · </span>
              )}
              {sale.customerPhone && <span>Phone: {sale.customerPhone}</span>}
            </div>
          )}

          {/* Items Table */}
          <div className="py-4">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Rate</th>
                  {sale.discountTotal > 0 && <th className="pb-2 text-right">Disc</th>}
                  <th className="pb-2 text-right">Tax%</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((it: SaleItem) => (
                  <tr key={it.id} className="text-xs">
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-slate-900">{it.productNameSnapshot}</div>
                      {it.serialNumber && (
                        <div className="font-mono text-[10px] text-slate-600 font-medium">
                          IMEI/SN: {it.serialNumber}
                        </div>
                      )}
                      {it.product?.warranty && (
                        <div className="text-[10px] text-emerald-800 font-medium">
                          Warranty: {it.product.warranty}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-1 text-center font-medium">{it.quantity}</td>
                    <td className="py-2.5 px-1 text-right">{fmt(it.unitSellingPrice)}</td>
                    {sale.discountTotal > 0 && (
                      <td className="py-2.5 px-1 text-right text-slate-600">
                        {it.discountAmount > 0 ? fmt(it.discountAmount) : "—"}
                      </td>
                    )}
                    <td className="py-2.5 px-1 text-right text-slate-600">{it.taxRateSnapshot}%</td>
                    <td className="py-2.5 pl-1 text-right font-bold text-slate-900">
                      {fmt(it.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div
            className={`border-t pt-3 space-y-1.5 ${layout === "thermal80" ? "border-dashed text-xs" : "text-sm max-w-xs ml-auto"}`}
          >
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-medium text-slate-900">{fmt(sale.subtotal)}</span>
            </div>

            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount:</span>
                <span className="font-medium">-{fmt(sale.discountTotal)}</span>
              </div>
            )}

            {taxBreakdown.map((t: { name: string; rate: number; amount: number }) => (
              <div key={t.name} className="flex justify-between text-xs text-slate-600">
                <span>{t.name}:</span>
                <span>{fmt(t.amount)}</span>
              </div>
            ))}

            <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
              <span>Grand Total:</span>
              <span>{fmt(sale.totalAmount)}</span>
            </div>

            {sale.payments?.length > 0 && (
              <div className="pt-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Payments:</div>
                {sale.payments.map((p: Payment) => (
                  <div key={p.id} className="flex justify-between text-[11px]">
                    <span>{p.method}</span>
                    <span className="font-medium">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer note & warranty */}
          <div
            className={`mt-8 border-t pt-4 text-center text-slate-600 ${layout === "thermal80" ? "border-dashed text-[10px]" : "text-xs"}`}
          >
            <p className="font-medium text-slate-800">
              Warranty claims require the original bill. Subject to manufacturer terms &amp;
              conditions.
            </p>
            {sale.shop?.invoiceFooter && (
              <p className="mt-1 text-slate-700 whitespace-pre-line font-medium">
                {sale.shop.invoiceFooter}
              </p>
            )}
            <p className="mt-3 font-bold text-slate-900 uppercase tracking-wider">
              Thank you for shopping with us!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
