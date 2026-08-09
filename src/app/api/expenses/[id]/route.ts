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

type UpdateExpenseInput = {
  title?: string;
  category?: (typeof EXPENSE_CATEGORIES)[number];
  amount?: number | string;
  expenseDate?: string;
  paymentMethod?: (typeof EXPENSE_PAYMENT_METHODS)[number];
  notes?: string | null;
};

function formatExpense<T extends { amount: unknown }>(expense: T) {
  return {
    ...expense,
    amount: Number(expense.amount ?? 0),
  };
}

function validateExpenseInput(body: UpdateExpenseInput) {
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

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/expenses/[id]">
) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json(
        { success: false, message: "Expense not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: formatExpense(expense),
    });
  } catch (error) {
    console.error("Failed to fetch expense:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch expense." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/expenses/[id]">
) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;
    const body = (await request.json()) as UpdateExpenseInput;
    const input = validateExpenseInput(body);

    const expense = await prisma.expense.update({
      where: { id },
      data: input,
    });

    return NextResponse.json({
      success: true,
      message: "Expense updated successfully.",
      data: formatExpense(expense),
    });
  } catch (error) {
    console.error("Failed to update expense:", error);

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
          error instanceof Error ? error.message : "Failed to update expense.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/expenses/[id]">
) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        deletedByUserId: currentUser.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully.",
      data: formatExpense(expense),
    });
  } catch (error) {
    console.error("Failed to delete expense:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to delete expense." },
      { status: 500 }
    );
  }
}
