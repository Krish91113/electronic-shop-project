import prisma from '../../config/db.js';
import { round2 } from '../../utils/money.js';

export async function getDashboard(shopId, from, to) {
  let fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
  let toDate = to ? new Date(to) : new Date();

  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    fromDate = new Date(`${from}T00:00:00.000Z`);
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    toDate = new Date(`${to}T23:59:59.999Z`);
  } else if (to && toDate.getUTCHours() === 0 && toDate.getUTCMinutes() === 0 && toDate.getUTCSeconds() === 0) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  // Total completed sales
  const salesAgg = await prisma.sale.aggregate({
    where: {
      shopId,
      status: 'COMPLETED',
      createdAt: { gte: fromDate, lte: toDate },
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  // COGS using cost snapshots
  const cogsResult = await prisma.$queryRaw`
    SELECT COALESCE(SUM(si."unitCostSnapshot" * si.quantity), 0) as cogs
    FROM "SaleItem" si
    JOIN "Sale" s ON si."saleId" = s.id
    WHERE s."shopId" = ${shopId}
      AND s.status = 'COMPLETED'
      AND s."createdAt" >= ${fromDate}
      AND s."createdAt" <= ${toDate}
  `;

  const netSales = round2(Number(salesAgg._sum.totalAmount || 0));
  const cogs = round2(Number(cogsResult[0]?.cogs || 0));
  const grossProfit = round2(netSales - cogs);

  // Low stock count
  const lowStockCount = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Inventory" i
    JOIN "Product" p ON i."productId" = p.id
    WHERE i."shopId" = ${shopId}
      AND i.quantity <= p."lowStockThreshold"
      AND p."isActive" = true
  `;

  // Recent sales
  const recentSales = await prisma.sale.findMany({
    where: { shopId, status: 'COMPLETED' },
    include: { items: { select: { productNameSnapshot: true, quantity: true, lineTotal: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return {
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    completedSales: salesAgg._count,
    netSales,
    grossProfit,
    lowStockCount: lowStockCount[0]?.count || 0,
    recentSales,
  };
}
