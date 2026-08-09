export type SalesReportMode = "TOTAL_SALES" | "SELECTED_ORDERS_SALES";

type SalesReportOrder = {
  id: string;
  orderId: string;
  vatOrderId: string | null;
  nonVatOrderId: string | null;
  customerName: string;
  orderType: "VAT" | "NON_VAT";
  totalAmount: unknown;
  paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  fulfillmentStatus: "UNFULFILLED" | "FULFILLED";
  deliveryStatus: "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
  orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
  createdAt: Date;
};

function decimalToNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber() as number;
  }

  return Number(value ?? 0);
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildSalesReport(
  orders: SalesReportOrder[],
  mode: SalesReportMode
) {
  const totals = orders.reduce(
    (summary, order) => {
      const totalAmount = decimalToNumber(order.totalAmount);

      summary.totalSalesAmount += totalAmount;
      summary.totalOrderCount += 1;

      if (order.orderType === "VAT") {
        summary.vatSalesAmount += totalAmount;
        summary.vatOrderCount += 1;
      } else {
        summary.nonVatSalesAmount += totalAmount;
        summary.nonVatOrderCount += 1;
      }

      return summary;
    },
    {
      totalSalesAmount: 0,
      vatSalesAmount: 0,
      nonVatSalesAmount: 0,
      totalOrderCount: 0,
      vatOrderCount: 0,
      nonVatOrderCount: 0,
    }
  );

  const paymentBreakdown = orders.reduce(
    (breakdown, order) => {
      const totalAmount = decimalToNumber(order.totalAmount);

      if (order.paymentStatus === "PAID") {
        breakdown.paidAmount += totalAmount;
        breakdown.paidCount += 1;
      } else if (order.paymentStatus === "DUE") {
        breakdown.dueAmount += totalAmount;
        breakdown.dueCount += 1;
      } else if (order.paymentStatus === "OVERDUE") {
        breakdown.overdueAmount += totalAmount;
        breakdown.overdueCount += 1;
      } else {
        breakdown.pendingAmount += totalAmount;
        breakdown.pendingCount += 1;
      }

      return breakdown;
    },
    {
      paidAmount: 0,
      pendingAmount: 0,
      dueAmount: 0,
      overdueAmount: 0,
      paidCount: 0,
      pendingCount: 0,
      dueCount: 0,
      overdueCount: 0,
    }
  );

  const dailySalesMap = new Map<
    string,
    {
      date: string;
      totalSalesAmount: number;
      vatSalesAmount: number;
      nonVatSalesAmount: number;
      orderCount: number;
    }
  >();

  for (const order of orders) {
    const date = getDateKey(order.createdAt);
    const totalAmount = decimalToNumber(order.totalAmount);
    const current = dailySalesMap.get(date) ?? {
      date,
      totalSalesAmount: 0,
      vatSalesAmount: 0,
      nonVatSalesAmount: 0,
      orderCount: 0,
    };

    current.totalSalesAmount += totalAmount;
    current.orderCount += 1;

    if (order.orderType === "VAT") {
      current.vatSalesAmount += totalAmount;
    } else {
      current.nonVatSalesAmount += totalAmount;
    }

    dailySalesMap.set(date, current);
  }

  const dailySales = Array.from(dailySalesMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const recentOrders = [...orders]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((order) => ({
      id: order.id,
      orderId: order.orderId,
      vatOrderId: order.vatOrderId,
      nonVatOrderId: order.nonVatOrderId,
      customerName: order.customerName,
      orderType: order.orderType,
      totalAmount: decimalToNumber(order.totalAmount),
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      deliveryStatus: order.deliveryStatus,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt,
    }));

  return {
    mode,
    summary: {
      ...totals,
      averageOrderValue:
        totals.totalOrderCount > 0
          ? totals.totalSalesAmount / totals.totalOrderCount
          : 0,
    },
    paymentBreakdown,
    dailySales,
    recentOrders,
  };
}
