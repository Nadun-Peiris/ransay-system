import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput, parseDateToInput } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import {
  buildSalesReport,
  type SalesReportMode,
} from "@/lib/reports/sales-report";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;
const EXPENSE_CATEGORIES = [
  "TRANSPORT",
  "SALARY",
  "RENT",
  "ELECTRICITY",
  "FUEL",
  "PACKAGING",
  "OFFICE",
  "MAINTENANCE",
  "MARKETING",
  "OTHER",
] as const;
const EXPENSE_PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
  "OTHER",
] as const;
const REPORT_MODES = ["TOTAL_SALES", "SELECTED_ORDERS_SALES"] as const;

type ProfitLossStatus = "PROFIT" | "LOSS" | "BREAK_EVEN";

type ExpenseRow = {
  id: string;
  title: string;
  category: (typeof EXPENSE_CATEGORIES)[number];
  amount: unknown;
  expenseDate: Date;
  paymentMethod: (typeof EXPENSE_PAYMENT_METHODS)[number];
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

function getEnumParam<T extends readonly string[]>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: T
): T[number] | undefined {
  const value = searchParams.get(key);

  if (value && value !== "ALL" && allowedValues.includes(value)) {
    return value as T[number];
  }

  return undefined;
}

function getDateParam(searchParams: URLSearchParams, key: string) {
  return parseDateInput(searchParams.get(key));
}

function getDateToParam(searchParams: URLSearchParams) {
  return parseDateToInput(searchParams.get("dateTo"));
}

function getProfitLossStatus(netProfitAmount: number): ProfitLossStatus {
  if (netProfitAmount > 0) return "PROFIT";
  if (netProfitAmount < 0) return "LOSS";
  return "BREAK_EVEN";
}

function buildExpenseBreakdown(expenses: ExpenseRow[]) {
  const categoryMap = new Map<
    string,
    { category: string; amount: number; count: number }
  >();
  const paymentMethodMap = new Map<
    string,
    { paymentMethod: string; amount: number; count: number }
  >();

  for (const expense of expenses) {
    const amount = decimalToNumber(expense.amount);
    const category = categoryMap.get(expense.category) ?? {
      category: expense.category,
      amount: 0,
      count: 0,
    };
    const paymentMethod = paymentMethodMap.get(expense.paymentMethod) ?? {
      paymentMethod: expense.paymentMethod,
      amount: 0,
      count: 0,
    };

    category.amount += amount;
    category.count += 1;
    paymentMethod.amount += amount;
    paymentMethod.count += 1;

    categoryMap.set(expense.category, category);
    paymentMethodMap.set(expense.paymentMethod, paymentMethod);
  }

  return {
    categoryBreakdown: Array.from(categoryMap.values()).sort(
      (a, b) => b.amount - a.amount
    ),
    paymentMethodBreakdown: Array.from(paymentMethodMap.values()).sort(
      (a, b) => b.amount - a.amount
    ),
  };
}

function buildDailyProfitLoss(
  dailySales: {
    date: string;
    totalSalesAmount: number;
  }[],
  expenses: ExpenseRow[]
) {
  const dailyMap = new Map<
    string,
    {
      date: string;
      salesAmount: number;
      expenseAmount: number;
      netProfitAmount: number;
    }
  >();

  for (const sale of dailySales) {
    dailyMap.set(sale.date, {
      date: sale.date,
      salesAmount: sale.totalSalesAmount,
      expenseAmount: 0,
      netProfitAmount: sale.totalSalesAmount,
    });
  }

  for (const expense of expenses) {
    const date = getDateKey(expense.expenseDate);
    const amount = decimalToNumber(expense.amount);
    const current = dailyMap.get(date) ?? {
      date,
      salesAmount: 0,
      expenseAmount: 0,
      netProfitAmount: 0,
    };

    current.expenseAmount += amount;
    current.netProfitAmount = current.salesAmount - current.expenseAmount;
    dailyMap.set(date, current);
  }

  return Array.from(dailyMap.values())
    .map((row) => ({
      ...row,
      netProfitAmount: row.salesAmount - row.expenseAmount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const requestedMode = getEnumParam(searchParams, "mode", REPORT_MODES);
    const mode: SalesReportMode =
      requestedMode ??
      (currentUser.role === "SUPERADMIN"
        ? "TOTAL_SALES"
        : "SELECTED_ORDERS_SALES");

    if (currentUser.role !== "SUPERADMIN" && mode === "TOTAL_SALES") {
      return NextResponse.json(
        { success: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const orderType = getEnumParam(searchParams, "orderType", ORDER_TYPES);
    const paymentStatus = getEnumParam(
      searchParams,
      "paymentStatus",
      PAYMENT_STATUSES
    );
    const createdByRole = getEnumParam(
      searchParams,
      "createdByRole",
      USER_ROLES
    );
    const expenseCategory = getEnumParam(
      searchParams,
      "expenseCategory",
      EXPENSE_CATEGORIES
    );
    const expensePaymentMethod = getEnumParam(
      searchParams,
      "expensePaymentMethod",
      EXPENSE_PAYMENT_METHODS
    );
    const dateFrom = getDateParam(searchParams, "dateFrom");
    const dateTo = getDateToParam(searchParams);

    const selectedOrdersVisibilityFilter = {
      OR: [
        { createdByRole: "ADMIN" },
        { createdByRole: "SUPERADMIN", orderType: "VAT" },
        {
          createdByRole: "SUPERADMIN",
          orderType: "NON_VAT",
          isSelected: true,
        },
      ],
    } satisfies Prisma.OrderWhereInput;

    const salesWhere: Prisma.OrderWhereInput = {
      deletedAt: null,
      orderStatus: {
        notIn: ["DELETED", "CANCELLED"],
      },
      AND: [
        ...(mode === "SELECTED_ORDERS_SALES"
          ? [selectedOrdersVisibilityFilter]
          : []),
        ...(orderType ? [{ orderType }] : []),
        ...(paymentStatus ? [{ paymentStatus }] : []),
        ...(createdByRole ? [{ createdByRole }] : []),
        ...(dateFrom || dateTo
          ? [
              {
                orderDate: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              },
            ]
          : []),
      ],
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {
      status: "ACTIVE",
      deletedAt: null,
      ...(expenseCategory ? { category: expenseCategory } : {}),
      ...(expensePaymentMethod
        ? { paymentMethod: expensePaymentMethod }
        : {}),
      ...(dateFrom || dateTo
        ? {
            expenseDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [orders, expenses] = await Promise.all([
      prisma.order.findMany({
        where: salesWhere,
        orderBy: [
          { orderDate: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        select: {
          id: true,
          orderId: true,
          vatOrderId: true,
          nonVatOrderId: true,
          customerName: true,
          orderType: true,
          totalAmount: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          deliveryStatus: true,
          orderStatus: true,
          orderDate: true,
          createdAt: true,
          batchAllocations: {
            where: { restoredAt: null },
            select: { totalCostLkr: true },
          },
        },
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          category: true,
          amount: true,
          expenseDate: true,
          paymentMethod: true,
          createdAt: true,
        },
      }),
    ]);

    const salesReport = buildSalesReport(orders, mode);
    const totalExpenseAmount = expenses.reduce(
      (sum, expense) => sum + decimalToNumber(expense.amount),
      0
    );
    const grossSalesAmount = salesReport.summary.totalSalesAmount;
    const costOfGoodsSold = orders.reduce(
      (sum, order) =>
        sum + order.batchAllocations.reduce(
          (orderSum, allocation) => orderSum + decimalToNumber(allocation.totalCostLkr),
          0
        ),
      0
    );
    const grossProfitAmount = grossSalesAmount - costOfGoodsSold;
    const netProfitAmount = grossProfitAmount - totalExpenseAmount;
    const expenseBreakdown = buildExpenseBreakdown(expenses);

    return NextResponse.json({
      success: true,
      data: {
        mode,
        summary: {
          grossSalesAmount,
          costOfGoodsSold,
          grossProfitAmount,
          totalExpenseAmount,
          netProfitAmount,
          status: getProfitLossStatus(netProfitAmount),
          profitMarginPercentage:
            grossSalesAmount > 0
              ? (netProfitAmount / grossSalesAmount) * 100
              : 0,
          salesOrderCount: salesReport.summary.totalOrderCount,
          expenseCount: expenses.length,
        },
        salesBreakdown: {
          vatSalesAmount: salesReport.summary.vatSalesAmount,
          nonVatSalesAmount: salesReport.summary.nonVatSalesAmount,
          vatOrderCount: salesReport.summary.vatOrderCount,
          nonVatOrderCount: salesReport.summary.nonVatOrderCount,
          paidAmount: salesReport.paymentBreakdown.paidAmount,
          pendingAmount: salesReport.paymentBreakdown.pendingAmount,
          dueAmount: salesReport.paymentBreakdown.dueAmount,
          overdueAmount: salesReport.paymentBreakdown.overdueAmount,
        },
        expenseBreakdown,
        dailyProfitLoss: buildDailyProfitLoss(
          salesReport.dailySales,
          expenses
        ),
        recentSales: salesReport.recentOrders.map((order) => ({
          id: order.id,
          orderId: order.orderId,
          vatOrderId: order.vatOrderId,
          nonVatOrderId: order.nonVatOrderId,
          customerName: order.customerName,
          orderType: order.orderType,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
          orderDate: order.orderDate,
          createdAt: order.createdAt,
        })),
        recentExpenses: expenses.slice(0, 10).map((expense) => ({
          id: expense.id,
          title: expense.title,
          category: expense.category,
          amount: decimalToNumber(expense.amount),
          expenseDate: expense.expenseDate,
          paymentMethod: expense.paymentMethod,
          createdAt: expense.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch profit and loss report:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch profit and loss report." },
      { status: 500 }
    );
  }
}
