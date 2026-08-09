import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

type ExpenseReportRow = {
  id: string;
  title: string;
  category: (typeof EXPENSE_CATEGORIES)[number];
  amount: unknown;
  expenseDate: Date;
  paymentMethod: (typeof EXPENSE_PAYMENT_METHODS)[number];
  notes: string | null;
  createdByRole: "ADMIN" | "SUPERADMIN" | null;
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
  const value = searchParams.get(key);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function getDateToParam(searchParams: URLSearchParams) {
  const dateTo = getDateParam(searchParams, "dateTo");

  if (!dateTo) {
    return undefined;
  }

  dateTo.setHours(23, 59, 59, 999);
  return dateTo;
}

function buildExpensesReport(expenses: ExpenseReportRow[]) {
  const totalExpenseAmount = expenses.reduce(
    (sum, expense) => sum + decimalToNumber(expense.amount),
    0
  );
  const totalExpenseCount = expenses.length;

  const categoryMap = new Map<
    string,
    { category: string; amount: number; count: number }
  >();
  const paymentMethodMap = new Map<
    string,
    { paymentMethod: string; amount: number; count: number }
  >();
  const dailyExpensesMap = new Map<
    string,
    { date: string; amount: number; count: number }
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
    const date = getDateKey(expense.expenseDate);
    const dailyExpense = dailyExpensesMap.get(date) ?? {
      date,
      amount: 0,
      count: 0,
    };

    category.amount += amount;
    category.count += 1;
    paymentMethod.amount += amount;
    paymentMethod.count += 1;
    dailyExpense.amount += amount;
    dailyExpense.count += 1;

    categoryMap.set(expense.category, category);
    paymentMethodMap.set(expense.paymentMethod, paymentMethod);
    dailyExpensesMap.set(date, dailyExpense);
  }

  return {
    summary: {
      totalExpenseAmount,
      totalExpenseCount,
      averageExpenseAmount:
        totalExpenseCount > 0 ? totalExpenseAmount / totalExpenseCount : 0,
    },
    categoryBreakdown: Array.from(categoryMap.values()).sort(
      (a, b) => b.amount - a.amount
    ),
    paymentMethodBreakdown: Array.from(paymentMethodMap.values()).sort(
      (a, b) => b.amount - a.amount
    ),
    dailyExpenses: Array.from(dailyExpensesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    ),
    recentExpenses: [...expenses]
      .sort(
        (a, b) =>
          b.expenseDate.getTime() - a.expenseDate.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime()
      )
      .slice(0, 10)
      .map((expense) => ({
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amount: decimalToNumber(expense.amount),
        expenseDate: expense.expenseDate,
        paymentMethod: expense.paymentMethod,
        notes: expense.notes,
        createdByRole: expense.createdByRole,
        createdAt: expense.createdAt,
      })),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser(request);

    const { searchParams } = new URL(request.url);
    const category = getEnumParam(searchParams, "category", EXPENSE_CATEGORIES);
    const paymentMethod = getEnumParam(
      searchParams,
      "paymentMethod",
      EXPENSE_PAYMENT_METHODS
    );
    const dateFrom = getDateParam(searchParams, "dateFrom");
    const dateTo = getDateToParam(searchParams);

    const expenses = await prisma.expense.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(dateFrom || dateTo
          ? {
              expenseDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        amount: true,
        expenseDate: true,
        paymentMethod: true,
        notes: true,
        createdByRole: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: buildExpensesReport(expenses),
    });
  } catch (error) {
    console.error("Failed to fetch expenses report:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch expenses report." },
      { status: 500 }
    );
  }
}
