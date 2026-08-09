import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
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

type CreateExpenseInput = {
  title?: string;
  category?: (typeof EXPENSE_CATEGORIES)[number];
  amount?: number | string;
  expenseDate?: string;
  paymentMethod?: (typeof EXPENSE_PAYMENT_METHODS)[number];
  notes?: string | null;
};

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

function formatExpense<T extends { amount: unknown }>(expense: T) {
  return {
    ...expense,
    amount: Number(expense.amount ?? 0),
  };
}

function validateExpenseInput(body: CreateExpenseInput) {
  const title = body.title?.trim();
  const amount = Number(body.amount);
  const expenseDate = body.expenseDate ? new Date(body.expenseDate) : null;

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!body.category || !EXPENSE_CATEGORIES.includes(body.category)) {
    throw new Error("Category is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
    throw new Error("Expense date is required.");
  }

  if (
    !body.paymentMethod ||
    !EXPENSE_PAYMENT_METHODS.includes(body.paymentMethod)
  ) {
    throw new Error("Payment method is required.");
  }

  return {
    title,
    category: body.category,
    amount,
    expenseDate,
    paymentMethod: body.paymentMethod,
    notes: body.notes?.trim() || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser(request);

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (safePage - 1) * safeLimit;
    const q = searchParams.get("q")?.trim();
    const category = getEnumParam(searchParams, "category", EXPENSE_CATEGORIES);
    const paymentMethod = getEnumParam(
      searchParams,
      "paymentMethod",
      EXPENSE_PAYMENT_METHODS
    );
    const statusParam = searchParams.get("status")?.toLowerCase();
    const dateFrom = getDateParam(searchParams, "dateFrom");
    const dateTo = getDateToParam(searchParams);

    const where: Prisma.ExpenseWhereInput = {
      AND: [
        ...(statusParam === "deleted"
          ? [{ status: "DELETED" as const }]
          : statusParam === "all"
            ? []
            : [{ status: "ACTIVE" as const, deletedAt: null }]),
        ...(q
          ? [
              {
                OR: [
                  { title: { contains: q, mode: "insensitive" as const } },
                  { notes: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
        ...(category ? [{ category }] : []),
        ...(paymentMethod ? [{ paymentMethod }] : []),
        ...(dateFrom || dateTo
          ? [
              {
                expenseDate: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              },
            ]
          : []),
      ],
    };

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: safeLimit,
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: expenses.map(formatExpense),
      meta: {
        page: safePage,
        limit: safeLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch expenses:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch expenses.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const body = (await request.json()) as CreateExpenseInput;
    const input = validateExpenseInput(body);

    const expense = await prisma.expense.create({
      data: {
        ...input,
        status: "ACTIVE",
        createdByUserId: currentUser.id,
        createdByRole: currentUser.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expense created successfully.",
      data: formatExpense(expense),
    });
  } catch (error) {
    console.error("Failed to create expense:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create expense.",
      },
      { status: 500 }
    );
  }
}
