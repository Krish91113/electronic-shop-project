import prisma from '../../config/db.js';
import { round2 } from '../../utils/money.js';

/**
 * Profit & Loss report using cost snapshots from SaleItems.
 */
export async function profitLoss(shopId, from, to, timezone) {
  let fromDate = new Date(from);
  let toDate = new Date(to);

  // If date-only string like YYYY-MM-DD, set start of day for fromDate and end of day for toDate
  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    fromDate = new Date(`${from}T00:00:00.000Z`);
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    toDate = new Date(`${to}T23:59:59.999Z`);
  } else if (toDate) {
    // If toDate is at exact midnight UTC (00:00:00), extend to end of day so all sales on that day are captured
    if (
      toDate.getUTCHours() === 0 &&
      toDate.getUTCMinutes() === 0 &&
      toDate.getUTCSeconds() === 0 &&
      toDate.getUTCMilliseconds() === 0
    ) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
  }

  // Net sales from completed/refunded sales
  const salesAgg = await prisma.sale.aggregate({
    where: {
      shopId,
      status: { in: ['COMPLETED'] },
      createdAt: { gte: fromDate, lte: toDate },
    },
    _sum: { subtotal: true, discountTotal: true, taxTotal: true, totalAmount: true },
    _count: true,
  });

  const netSales = round2(
    Number(salesAgg._sum.subtotal || 0) - Number(salesAgg._sum.discountTotal || 0)
  );

  // COGS: sum of (unitCostSnapshot * quantity) from sale items of completed sales
  const cogsResult = await prisma.$queryRaw`
    SELECT COALESCE(SUM(si."unitCostSnapshot" * si.quantity), 0) as cogs
    FROM "SaleItem" si
    JOIN "Sale" s ON si."saleId" = s.id
    WHERE s."shopId" = ${shopId}
      AND s.status = 'COMPLETED'
      AND s."createdAt" >= ${fromDate}
      AND s."createdAt" <= ${toDate}
  `;
  const cogs = round2(Number(cogsResult[0]?.cogs || 0));

  // Returns / refunds
  const refunds = await prisma.sale.aggregate({
    where: {
      shopId,
      status: { in: ['CANCELLED', 'REFUNDED'] },
      createdAt: { gte: fromDate, lte: toDate },
    },
    _sum: { totalAmount: true },
    _count: true,
  });
  const refundTotal = round2(Number(refunds._sum.totalAmount || 0));

  // Expenses
  const expensesAgg = await prisma.expense.aggregate({
    where: {
      shopId,
      date: { gte: fromDate, lte: toDate },
    },
    _sum: { amount: true },
  });
  const totalExpenses = round2(Number(expensesAgg._sum.amount || 0));

  const grossProfit = round2(netSales - cogs);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    period: { from, to, timezone },
    salesCount: salesAgg._count,
    netSales,
    discounts: round2(Number(salesAgg._sum.discountTotal || 0)),
    taxCollected: round2(Number(salesAgg._sum.taxTotal || 0)),
    refunds: refundTotal,
    refundCount: refunds._count,
    cogs,
    grossProfit,
    operatingExpenses: totalExpenses,
    netProfit,
    note: 'Net profit is an estimate; system does not implement full accounting.',
  };
}
