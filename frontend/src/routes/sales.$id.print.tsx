import { useState } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft, AlertCircle, FileText, Receipt, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sales as salesApi, getErrorMessage } from "@/lib/api";
import { InvoiceDocument } from "@/components/shop/invoice-document";

export const Route = createFileRoute("/sales/$id/print")({
  component: PrintableBillPage,
});

export function PrintableBillPage() {
  const { id } = useParams({ strict: false });
  const [layout, setLayout] = useState<"a4" | "thermal80">("a4");
  const [copies, setCopies] = useState<1 | 2 | 3>(1);

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

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 print:bg-white print:p-0">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          .invoice-page {
            box-shadow: none !important;
            border: 1px solid black !important;
            margin: 0 auto 0 auto !important;
            page-break-after: always;
            break-after: page;
          }
          .invoice-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .layout-thermal80 {
            width: 78mm !important;
            max-width: 78mm !important;
            padding: 2mm !important;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Screen toolbar (hidden during print) */}
      <div className="no-print mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/sales/$id" params={{ id: id! }}>
              <ArrowLeft size={14} className="mr-1.5" />
              Back to Invoice
            </Link>
          </Button>

          <span className="text-xs text-muted-foreground hidden sm:inline">|</span>

          {/* Layout switcher */}
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
              A4 GST Invoice
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

          {/* Copies selector (for A4) */}
          {layout === "a4" && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
              <span className="px-2 text-slate-500 font-semibold flex items-center gap-1">
                <Copy size={11} /> Copies:
              </span>
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors ${
                  copies === 1
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setCopies(1)}
                title="Original for Recipient"
              >
                1 (Original)
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors ${
                  copies === 2
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setCopies(2)}
                title="Original + Duplicate"
              >
                2 (+ Transporter)
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors ${
                  copies === 3
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setCopies(3)}
                title="Original + Duplicate + Triplicate"
              >
                3 (+ Supplier)
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            title="Download PDF via browser Print -> Save as PDF"
          >
            <Download size={14} className="mr-1.5" />
            Save as PDF
          </Button>
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
          Loading printable GST bill…
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
      ) : layout === "thermal80" ? (
        <div className="bg-white p-4 max-w-[80mm] mx-auto rounded-lg shadow-sm border print:border-none print:shadow-none">
          <InvoiceDocument sale={sale} isThermal={true} />
        </div>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {/* Copy 1: Original */}
          <InvoiceDocument sale={sale} copyLabel="ORIGINAL FOR RECIPIENT" />

          {/* Copy 2: Duplicate (Transporter) */}
          {copies >= 2 && <InvoiceDocument sale={sale} copyLabel="DUPLICATE FOR TRANSPORTER" />}

          {/* Copy 3: Triplicate (Supplier) */}
          {copies >= 3 && <InvoiceDocument sale={sale} copyLabel="TRIPLICATE FOR SUPPLIER" />}
        </div>
      )}
    </div>
  );
}
