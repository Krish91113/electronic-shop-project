import { round2 } from './money.js';

/**
 * Calculate GST breakdown for inclusive pricing (Addendum 10).
 *
 * Owner enters inclusivePrice (e.g. 19,999)
 * lineGross = round2(price * qty - discount)
 * lineTaxable = round2(lineGross / (1 + rate / 100))
 * lineTax = round2(lineGross - lineTaxable)
 *
 * Intra-state:
 *   CGST = round2(lineTax / 2)
 *   SGST = lineTax - CGST (guarantees CGST + SGST === lineTax)
 *   IGST = 0
 * Inter-state:
 *   CGST = 0
 *   SGST = 0
 *   IGST = lineTax
 *
 * Customer pays exactly lineGross.
 */
export function splitInclusive(price, qty = 1, discount = 0, rate = 0, { isInterState = false } = {}) {
  const unitPrice = round2(Number(price || 0));
  const quantity = parseInt(qty, 10) || 1;
  const discountAmount = round2(Number(discount || 0));
  const taxRate = Number(rate || 0);

  const lineGross = round2(unitPrice * quantity - discountAmount);
  if (lineGross <= 0 || taxRate <= 0) {
    return {
      gross: Math.max(0, lineGross),
      taxable: Math.max(0, lineGross),
      tax: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      unitBasePrice: quantity > 0 ? round2(Math.max(0, lineGross) / quantity) : 0,
      rate: taxRate,
    };
  }

  const lineTaxable = round2(lineGross / (1 + taxRate / 100));
  const lineTax = round2(lineGross - lineTaxable);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = lineTax;
  } else {
    cgst = round2(lineTax / 2);
    sgst = round2(lineTax - cgst);
  }

  const unitBasePrice = quantity > 0 ? round2(lineTaxable / quantity) : 0;

  return {
    gross: lineGross,
    taxable: lineTaxable,
    tax: lineTax,
    cgst,
    sgst,
    igst,
    unitBasePrice,
    rate: taxRate,
  };
}

/**
 * Legacy exclusive tax calculation (where tax is added on top of taxable value).
 */
export function addExclusive(price, qty = 1, discount = 0, rate = 0, { isInterState = false } = {}) {
  const unitPrice = round2(Number(price || 0));
  const quantity = parseInt(qty, 10) || 1;
  const discountAmount = round2(Number(discount || 0));
  const taxRate = Number(rate || 0);

  const lineSubtotal = round2(unitPrice * quantity);
  const lineTaxable = round2(lineSubtotal - discountAmount);
  const lineTax = taxRate > 0 ? round2((lineTaxable * taxRate) / 100) : 0;
  const lineGross = round2(lineTaxable + lineTax);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = lineTax;
  } else {
    cgst = round2(lineTax / 2);
    sgst = round2(lineTax - cgst);
  }

  return {
    gross: lineGross,
    taxable: lineTaxable,
    tax: lineTax,
    cgst,
    sgst,
    igst,
    unitBasePrice: unitPrice,
    rate: taxRate,
  };
}
