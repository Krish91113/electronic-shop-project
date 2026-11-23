import React from "react";
import { type Sale, type SaleItem } from "@/lib/api";

const fmt = (n: number | string | undefined | null): string => {
  const num = typeof n === "number" ? n : Number(n ?? 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtMoney = (n: number | string | undefined | null): string => "₹" + fmt(n);

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export interface InvoiceDocumentProps {
  sale: Sale;
  copyLabel?: string;
  isThermal?: boolean;
}

export function InvoiceDocument({
  sale,
  copyLabel = "ORIGINAL FOR RECIPIENT",
  isThermal = false,
}: InvoiceDocumentProps) {
  const shop = sale.shop;
  const items = sale.items ?? [];

  // Group items by HSN & tax rate for the GST summary table
  const taxGroups = items.reduce(
    (
      acc: Record<
        string,
        {
          hsn: string;
          rate: number;
          taxable: number;
          cgst: number;
          sgst: number;
          igst: number;
          totalTax: number;
        }
      >,
      it: SaleItem,
    ) => {
      const hsn = it.hsnCode || it.hsnSnapshot || it.product?.hsnCode || "8517";
      const rate = Number(it.taxRateSnapshot ?? it.product?.taxCategory?.rate ?? 0);
      const key = `${hsn}-${rate}`;

      const lineBase = Number(
        it.lineBase ?? (Number(it.unitSellingPrice) * it.quantity) / (1 + rate / 100),
      );
      const lineTax = Number(it.lineTax ?? Number(it.taxAmount ?? 0));
      const isIntraState = (sale.customerStateCode || "20") === (shop?.stateCode || "20");

      if (!acc[key]) {
        acc[key] = {
          hsn,
          rate,
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
        };
      }

      acc[key].taxable += lineBase;
      acc[key].totalTax += lineTax;
      if (isIntraState) {
        const half = Number((lineTax / 2).toFixed(2));
        acc[key].cgst += half;
        acc[key].sgst += Number((lineTax - half).toFixed(2));
      } else {
        acc[key].igst += lineTax;
      }

      return acc;
    },
    {},
  );

  const taxRows = Object.values(taxGroups);
  const totalBilledQty = items.reduce((s, it) => s + it.quantity, 0);
  const totalAmountBeforeTax = taxRows.reduce((s, r) => s + r.taxable, 0);
  const totalCgst = taxRows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = taxRows.reduce((s, r) => s + r.sgst, 0);
  const totalIgst = taxRows.reduce((s, r) => s + r.igst, 0);
  const totalTaxAmount = taxRows.reduce((s, r) => s + r.totalTax, 0);

  const isIntraState = (sale.customerStateCode || "20") === (shop?.stateCode || "20");

  // Brands serviced array or string
  const brandsList: string[] = Array.isArray(shop?.brandsServiced)
    ? (shop.brandsServiced as string[])
    : typeof shop?.brandsServiced === "string"
      ? (shop.brandsServiced as string)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["NOKIA", "SAMSUNG", "vivo", "oppo", "mi", "Realme", "TECNO"];

  // ─── 80mm Thermal Receipt ───────────────────────────────────────
  if (isThermal) {
    return (
      <div className="layout-thermal80 font-mono text-[11px] leading-tight text-black p-2 bg-white max-w-[78mm] mx-auto">
        {sale.status === "CANCELLED" && (
          <div className="text-center font-bold text-red-600 border border-dashed border-red-600 p-1 mb-2">
            *** CANCELLED SALE ***
          </div>
        )}
        <div className="text-center border-b pb-2 mb-2">
          <div className="font-bold text-[10px] tracking-wider uppercase mb-1">
            TAX INVOICE / CASH MEMO
          </div>
          <h1 className="text-sm font-bold uppercase">{shop?.name || "TIME CENTRE"}</h1>
          <p className="text-[10px]">{shop?.tagline || "Mobile Sale & Service"}</p>
          <p className="text-[10px]">{shop?.address || "Akhara Chowk, Bishnugarh, Hazaribagh"}</p>
          <p className="text-[10px]">
            Ph: {shop?.contactPhone || "7004114744"}
            {shop?.alternatePhone ? `, ${shop.alternatePhone}` : ""}
          </p>
          <p className="text-[10px] font-bold">GSTIN: {shop?.gstin || "20EBEPK7095A1Z0"}</p>
        </div>

        <div className="border-b pb-1 mb-1 text-[10px]">
          <div className="flex justify-between">
            <span>Inv: #{sale.invoiceNumber}</span>
            <span>{formatDate(sale.createdAt)}</span>
          </div>
          <div>Customer: {sale.customerName || "Cash Customer"}</div>
          {sale.customerPhone && <div>Phone: {sale.customerPhone}</div>}
          {sale.customerGstin && <div>GSTIN: {sale.customerGstin}</div>}
        </div>

        {/* Items */}
        <div className="border-b pb-2 mb-2">
          <div className="flex justify-between font-bold text-[10px] border-b pb-0.5">
            <span>Item</span>
            <span>Qty · Price</span>
          </div>
          {items.map((it, idx) => {
            const imei1 = it.imeiSnapshot || it.imei || it.serialNumber;
            const imei2 = it.imei2Snapshot || it.imei2;
            const charger = it.chargerNoSnapshot || it.chargerNo;

            return (
              <div key={idx} className="py-1 border-b border-dotted last:border-b-0 text-[10px]">
                <div className="font-semibold">{it.productNameSnapshot}</div>
                {imei1 && <div className="text-[9px]">IMEI: {imei1}</div>}
                {imei2 && <div className="text-[9px]">IMEI 2: {imei2}</div>}
                {charger && <div className="text-[9px]">Charger: {charger}</div>}
                <div className="flex justify-between text-[10px]">
                  <span>
                    {it.quantity} × {fmt(it.unitSellingPrice)}
                  </span>
                  <span className="font-bold">
                    {fmt(Number(it.unitSellingPrice) * it.quantity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="space-y-0.5 text-[10px] border-b pb-2 mb-2">
          <div className="flex justify-between">
            <span>Taxable Value:</span>
            <span>{fmtMoney(totalAmountBeforeTax)}</span>
          </div>
          {isIntraState ? (
            <>
              <div className="flex justify-between">
                <span>CGST:</span>
                <span>{fmtMoney(totalCgst)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST:</span>
                <span>{fmtMoney(totalSgst)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span>IGST:</span>
              <span>{fmtMoney(totalIgst)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xs pt-1 border-t">
            <span>Total Payable:</span>
            <span>{fmtMoney(sale.totalAmount)}</span>
          </div>
          <div className="text-[9px] text-muted-foreground pt-0.5">
            Mode: {sale.paymentMode || "Cash"}
          </div>
        </div>

        {/* Words */}
        {sale.amountInWords && (
          <div className="text-[9px] italic border-b pb-1 mb-2">Amount: {sale.amountInWords}</div>
        )}

        {/* EMI Warning Note */}
        <div className="text-[9.5px] text-center font-bold border-t border-b py-1 mb-2 bg-slate-50">
          नोट: EMI कटने के तारीख से 3 दिन पहले A/c में पैसा डाल के रखना अनिवार्य है
        </div>

        <div className="text-center text-[9px] text-muted-foreground">
          {shop?.upiId && <p className="font-mono text-black font-semibold">UPI: {shop.upiId}</p>}
          <p>{shop?.warrantyNote || "All warranty & guaranty by Manufacturer."}</p>
          <p className="font-semibold mt-1">Thank you for visiting Time Centre!</p>
        </div>
      </div>
    );
  }

  // ─── A4 GST Tax Invoice (Matches Green Leaf Ltd reference) ─────────
  return (
    <div className="invoice-page a4-invoice bg-white text-black font-sans text-[11px] leading-tight max-w-[210mm] mx-auto p-4 sm:p-6 border border-black shadow-sm print:shadow-none print:border-black print:p-2 print:m-0">
      {/* Cancellation or Refund Stamp */}
      {sale.status === "CANCELLED" && (
        <div className="mb-2 p-1.5 border-2 border-dashed border-red-600 bg-red-50 text-red-700 text-center font-bold text-sm tracking-wider uppercase">
          *** CANCELLED SALE — TRANSACTION VOIDED ***
        </div>
      )}
      {(sale.status === "REFUNDED" || sale.status === "PARTIALLY_REFUNDED") && (
        <div className="mb-2 p-1 border border-amber-600 bg-amber-50 text-amber-800 text-center font-bold text-xs uppercase">
          STATUS: {sale.status.replace("_", " ")}
        </div>
      )}

      {/* ── Top Header Title & Copy Type ── */}
      <div className="flex justify-between items-center text-[10px] pb-1 border-b border-black">
        <div className="w-1/3" />
        <div className="w-1/3 text-center font-bold tracking-wider text-xs">TAX INVOICE</div>
        <div className="w-1/3 text-right font-medium italic uppercase tracking-wider text-[9px]">
          {copyLabel}
        </div>
      </div>

      {/* ── Shop Header (Centered with leaf icon/logo) ── */}
      <div className="text-center py-2 border-b border-black relative">
        {/* Leaf / Brand mark */}
        <div className="flex justify-center items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-xs">
            TC
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase">
            {shop?.name || "TIME CENTRE"}
          </h1>
        </div>

        <p className="text-[10px] font-semibold text-slate-800">
          {shop?.tagline || "Mobile Sale & Service — All Types of Mobile Repairing here"}
        </p>
        <p className="text-[10px]">
          {shop?.address || "Akhara Chowk, Bishnugarh, Near Post Office, Hazaribagh, Jharkhand"}
        </p>
        <p className="text-[10px]">
          State Name : <span className="font-semibold">{shop?.state || "Jharkhand"}</span>, Code :{" "}
          <span className="font-semibold">{shop?.stateCode || "20"}</span>
        </p>
        <p className="text-[10px]">
          Contact : <span className="font-semibold">{shop?.contactPhone || "7004114744"}</span>
          {shop?.alternatePhone ? `, ${shop.alternatePhone}` : ", 7033389366"}
          {shop?.contactEmail ? `, E-mail : ${shop.contactEmail}` : ""}
        </p>
        <p className="text-[11px] font-bold tracking-wider mt-0.5">
          GSTIN: {shop?.gstin || "20EBEPK7095A1Z0"}
        </p>

        {/* Brands Serviced Ribbon */}
        {brandsList.length > 0 && (
          <div className="mt-1 pt-1 border-t border-dotted border-slate-300 text-[9px] text-slate-600 tracking-wider">
            DEALS IN: {brandsList.join(" · ")}
          </div>
        )}
      </div>

      {/* ── Two Column Details Box (Buyer & Invoice Info) ── */}
      <div className="grid grid-cols-2 border-b border-black text-[10px]">
        {/* Left: Buyer Details */}
        <div className="p-2 border-r border-black space-y-0.5">
          <div className="font-bold underline mb-1">
            Details for Buyer (Billed &amp; Shipped To)
          </div>
          <div className="font-bold text-xs">{sale.customerName || "Cash Customer"}</div>
          <div>{sale.customerAddress || "Akhara Chowk, Bishnugarh, Hazaribagh"}</div>
          <div>
            State Name : <span className="font-semibold">{sale.customerState || "Jharkhand"}</span>{" "}
            Code : <span className="font-semibold">{sale.customerStateCode || "20"}</span>
          </div>
          <div>
            GSTIN No : <span className="font-mono font-semibold">{sale.customerGstin || "—"}</span>
          </div>
          <div>
            Contact Details : <span className="font-semibold">{sale.customerPhone || "—"}</span>
          </div>
          {sale.customerAadhaar && (
            <div>
              Aadhaar (Last 4) :{" "}
              <span className="font-mono font-semibold">
                XXXX-XXXX-{sale.customerAadhaar.slice(-4)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Invoice Info */}
        <div className="p-2 space-y-1 font-medium">
          <div className="grid grid-cols-3">
            <span className="text-slate-600">Invoice No.</span>
            <span className="col-span-2 font-mono font-bold text-xs">: <span>{sale.invoiceNumber}</span></span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-600">Dated</span>
            <span className="col-span-2 font-semibold">: {formatDate(sale.createdAt)}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-600">Place of Supply</span>
            <span className="col-span-2">: {sale.placeOfSupply || "Jharkhand (20)"}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-600">Mode of Payment</span>
            <span className="col-span-2 font-bold uppercase">: {sale.paymentMode || "Cash"}</span>
          </div>
          <div className="grid grid-cols-3">
            <span className="text-slate-600">Terms of Delivery</span>
            <span className="col-span-2">: TERMS &amp; CONDITIONS</span>
          </div>
        </div>
      </div>

      {/* ── Items Table ── */}
      <div className="border-b border-black">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-black text-center font-bold bg-slate-50">
              <th className="p-1.5 border-r border-black w-8">Sr No</th>
              <th className="p-1.5 border-r border-black text-left">Item Description</th>
              <th className="p-1.5 border-r border-black w-16">HSN Code</th>
              <th className="p-1.5 border-r border-black w-14">Billed Qty</th>
              <th className="p-1.5 border-r border-black w-10">Per</th>
              <th className="p-1.5 border-r border-black w-20 text-right">Rate</th>
              <th className="p-1.5 w-24 text-right">Gross Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const hsn = it.hsnCode || it.hsnSnapshot || it.product?.hsnCode || "8517";
              const rate = Number(it.taxRateSnapshot ?? it.product?.taxCategory?.rate ?? 0);
              const lineBase = Number(
                it.lineBase ?? (Number(it.unitSellingPrice) * it.quantity) / (1 + rate / 100),
              );
              const unitBaseRate = lineBase / it.quantity;
              const imei1 = it.imeiSnapshot || it.imei || it.serialNumber;
              const imei2 = it.imei2Snapshot || it.imei2;
              const chargerNo = it.chargerNoSnapshot || it.chargerNo;

              return (
                <tr key={idx} className="align-top border-b border-slate-200">
                  <td className="p-1.5 border-r border-black text-center font-mono">{idx + 1}</td>
                  <td className="p-1.5 border-r border-black">
                    <div className="font-bold text-xs">{it.productNameSnapshot}</div>
                    <div className="font-mono text-[9px] text-slate-700 space-y-0.5 mt-0.5">
                      {imei1 && <div>IMEI/SN: {imei1}</div>}
                      {imei2 && <div>IMEI 2: {imei2}</div>}
                      {chargerNo && <div>Charger No: {chargerNo}</div>}
                      {it.product?.warranty && (
                        <div className="font-sans text-[8px] text-slate-500">
                          Warranty: {it.product.warranty}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-1.5 border-r border-black text-center font-mono">{hsn}</td>
                  <td className="p-1.5 border-r border-black text-center font-semibold">
                    {it.quantity} pcs
                  </td>
                  <td className="p-1.5 border-r border-black text-center text-slate-600">pcs</td>
                  <td className="p-1.5 border-r border-black text-right font-mono">
                    {fmt(unitBaseRate)}
                  </td>
                  <td className="p-1.5 text-right font-mono font-semibold">{fmt(lineBase)}</td>
                </tr>
              );
            })}

            {/* Spacer row to match printed invoice height */}
            {items.length < 3 && (
              <tr style={{ height: `${(3 - items.length) * 45}px` }}>
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td />
              </tr>
            )}

            {/* Total Row */}
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td colSpan={3} className="p-1.5 border-r border-black text-center tracking-wider">
                TOTAL
              </td>
              <td className="p-1.5 border-r border-black text-center font-mono">
                {totalBilledQty} pcs
              </td>
              <td className="p-1.5 border-r border-black text-center" />
              <td className="p-1.5 border-r border-black text-right" />
              <td className="p-1.5 text-right font-mono">{fmt(totalAmountBeforeTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Tax Breakdown Table & Right Totals ── */}
      <div className="grid grid-cols-12 border-b border-black text-[9px]">
        {/* Left: GST Summary Table (7 Cols) */}
        <div className="col-span-7 border-r border-black">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-black font-bold bg-slate-50">
                <th className="p-1 border-r border-black">HSN/SAC</th>
                <th className="p-1 border-r border-black text-right">Taxable Value</th>
                {isIntraState ? (
                  <>
                    <th colSpan={2} className="p-1 border-r border-black">
                      Central Tax
                    </th>
                    <th colSpan={2} className="p-1 border-r border-black">
                      State Tax
                    </th>
                  </>
                ) : (
                  <th colSpan={2} className="p-1 border-r border-black">
                    Integrated Tax
                  </th>
                )}
                <th className="p-1 text-right">Total Tax Amount</th>
              </tr>
              <tr className="border-b border-black text-[8px] bg-slate-50 font-semibold">
                <th className="border-r border-black" />
                <th className="border-r border-black" />
                {isIntraState ? (
                  <>
                    <th className="p-0.5 border-r border-black">Rate</th>
                    <th className="p-0.5 border-r border-black text-right">Amount</th>
                    <th className="p-0.5 border-r border-black">Rate</th>
                    <th className="p-0.5 border-r border-black text-right">Amount</th>
                  </>
                ) : (
                  <>
                    <th className="p-0.5 border-r border-black">Rate</th>
                    <th className="p-0.5 border-r border-black text-right">Amount</th>
                  </>
                )}
                <th />
              </tr>
            </thead>
            <tbody>
              {taxRows.map((tr, idx) => (
                <tr key={idx} className="border-b border-slate-200 font-mono">
                  <td className="p-1 border-r border-black">{tr.hsn}</td>
                  <td className="p-1 border-r border-black text-right">{fmt(tr.taxable)}</td>
                  {isIntraState ? (
                    <>
                      <td className="p-1 border-r border-black">{(tr.rate / 2).toFixed(2)}%</td>
                      <td className="p-1 border-r border-black text-right">{fmt(tr.cgst)}</td>
                      <td className="p-1 border-r border-black">{(tr.rate / 2).toFixed(2)}%</td>
                      <td className="p-1 border-r border-black text-right">{fmt(tr.sgst)}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-1 border-r border-black">{tr.rate.toFixed(2)}%</td>
                      <td className="p-1 border-r border-black text-right">{fmt(tr.igst)}</td>
                    </>
                  )}
                  <td className="p-1 text-right">{fmt(tr.totalTax)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t border-black bg-slate-50 font-mono">
                <td className="p-1 border-r border-black">Total</td>
                <td className="p-1 border-r border-black text-right">
                  {fmt(totalAmountBeforeTax)}
                </td>
                {isIntraState ? (
                  <>
                    <td className="p-1 border-r border-black" />
                    <td className="p-1 border-r border-black text-right">{fmt(totalCgst)}</td>
                    <td className="p-1 border-r border-black" />
                    <td className="p-1 border-r border-black text-right">{fmt(totalSgst)}</td>
                  </>
                ) : (
                  <>
                    <td className="p-1 border-r border-black" />
                    <td className="p-1 border-r border-black text-right">{fmt(totalIgst)}</td>
                  </>
                )}
                <td className="p-1 text-right">{fmt(totalTaxAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Totals Box (5 Cols) */}
        <div className="col-span-5 p-1.5 space-y-1 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="font-sans text-slate-700">Total Amount Before Tax</span>
            <span className="font-semibold">{fmt(totalAmountBeforeTax)}</span>
          </div>
          {isIntraState ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">CGST</span>
                <span>{fmt(totalCgst)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">SGST</span>
                <span>{fmt(totalSgst)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">IGST</span>
              <span>{fmt(totalIgst)}</span>
            </div>
          )}
          {Number(sale.roundOff ?? 0) !== 0 && (
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Round Off</span>
              <span>{fmt(sale.roundOff)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xs pt-1.5 border-t-2 border-black">
            <span className="font-sans uppercase">Invoice Total</span>
            <span className="text-black font-black">{fmtMoney(sale.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* ── Amount in Words ── */}
      <div className="p-2 border-b border-black text-[10px]">
        <span className="font-semibold text-slate-600">Amount in Words : </span>
        <span className="font-bold">
          {sale.amountInWords || `INR ${fmt(sale.totalAmount)} Only`}
        </span>
      </div>

      {/* ── Bottom Section (Balances, Bank details, Terms, Signature) ── */}
      <div className="grid grid-cols-2 border-b border-black text-[10px]">
        {/* Bottom Left */}
        <div className="p-2 border-r border-black space-y-2">
          {/* Outstanding Balance block */}
          <div>
            <div className="font-bold underline text-[9px] mb-0.5">
              Party's Outstanding Balance :
            </div>
            <div className="font-mono text-[9px] space-y-0.5">
              <div className="flex justify-between">
                <span>Previous Balance</span>
                <span>: 0.00 Dr</span>
              </div>
              <div className="flex justify-between">
                <span>Bill Amount</span>
                <span>: {fmt(sale.totalAmount)} Dr</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-0.5">
                <span>Total Balance Amount</span>
                <span>: {fmt(sale.totalAmount)} Dr</span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="pt-1">
            <span className="font-bold text-[9px]">Remarks : </span>
            <span className="text-[9px] text-slate-700">
              {sale.notes ||
                shop?.invoiceFooter ||
                shop?.warrantyNote ||
                "All warranty & guaranty by Manufacturer."}
            </span>
          </div>

          {/* EMI Reminder Note */}
          <div className="pt-1 text-[9.5px] font-bold text-slate-900 border-t border-dotted border-slate-300 mt-1">
            📌 नोट: EMI कटने के तारीख से 3 दिन पहले A/c में पैसा डाल के रखना अनिवार्य है
          </div>

          {/* Declaration */}
          <div className="pt-1 text-[8px] text-slate-600 leading-tight">
            <strong>Declaration :</strong>
            <br />
            We declare that this invoice shows the actual price of the goods described and that all
            particulars are true and correct.
          </div>
        </div>

        {/* Bottom Right */}
        <div className="p-2 flex flex-col justify-between">
          {/* Bank Details */}
          <div>
            <div className="font-bold underline text-[9px] mb-0.5">
              Bank Details for Neft / RTGS :
            </div>
            <div className="space-y-0.5 text-[9px]">
              <div className="grid grid-cols-3">
                <span className="text-slate-600">Bank Name</span>
                <span className="col-span-2 font-semibold">
                  : {shop?.bankName || "State Bank of India"}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-600">A/c No.</span>
                <span className="col-span-2 font-mono font-bold">
                  : {shop?.bankAccountNo || "452414541254"}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-600">Branch &amp; IFS</span>
                <span className="col-span-2 font-mono">
                  : {shop?.bankBranch || "Bishnugarh"} &amp; {shop?.bankIfsc || "SBIN0001234"}
                </span>
              </div>
              {shop?.upiId && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-600">UPI ID</span>
                  <span className="col-span-2 font-mono font-semibold">: {shop.upiId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-4 text-right">
            <div className="font-bold text-[10px]">For {shop?.name || "TIME CENTRE"}</div>
            <div className="h-10" />
            <div className="font-semibold text-[9px] border-t border-slate-300 inline-block pt-0.5 px-4">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions Footer Note */}
      {shop?.termsAndConditions && (
        <div className="pt-1.5 text-[8px] text-slate-500 leading-tight">
          <strong>Terms &amp; Conditions: </strong>
          {shop.termsAndConditions}
        </div>
      )}
    </div>
  );
}
