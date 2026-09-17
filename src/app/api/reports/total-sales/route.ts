import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput, parseDateToInput } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { buildSalesReport } from "@/lib/reports/sales-report";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);

    if (currentUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
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
    const dateFrom = getDateParam(searchParams, "dateFrom");
    const dateTo = getDateToParam(searchParams);

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      orderStatus: {
        notIn: ["DELETED", "CANCELLED"],
      },
      AND: [
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

    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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
      },
    });

    return NextResponse.json({
      success: true,
      data: buildSalesReport(orders, "TOTAL_SALES"),
    });
  } catch (error) {
    console.error("Failed to fetch total sales report:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch total sales report." },
      { status: 500 }
    );
  }
}
