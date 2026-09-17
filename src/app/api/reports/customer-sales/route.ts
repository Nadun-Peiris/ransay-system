import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput, parseDateToInput } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

type CustomerSalesRow = {
  customerId: string;
  customerName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  customerType: "VAT" | "NON_VAT";
  vatNumber: string | null;
  vatSalesAmount: number;
  nonVatSalesAmount: number;
  totalSalesAmount: number;
  orderCount: number;
  lastOrderDate: Date;
  totalCostLkr: number;
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
    const customerId = searchParams.get("customerId")?.trim();
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
        ...(customerId ? [{ customerId }] : []),
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
        customerId: true,
        customerName: true,
        customerContactPerson: true,
        customerPhone: true,
        customerTypeSnapshot: true,
        customerVatNumberSnapshot: true,
        orderType: true,
        totalAmount: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        deliveryStatus: true,
        orderStatus: true,
        orderDate: true,
        createdAt: true,
        customer: {
          select: {
            customerName: true,
            contactPerson: true,
            phone: true,
            email: true,
            customerType: true,
            vatNumber: true,
          },
        },
        batchAllocations: {
          where: { restoredAt: null },
          select: { totalCostLkr: true },
        },
      },
    });

    const customerMap = new Map<string, CustomerSalesRow>();
    const vatOrderIds = new Set<string>();
    const nonVatOrderIds = new Set<string>();
    const paidOrderIds = new Set<string>();
    const pendingOrderIds = new Set<string>();
    const dueOrderIds = new Set<string>();
    const overdueOrderIds = new Set<string>();
    const dailyMap = new Map<
      string,
      {
        date: string;
        totalSalesAmount: number;
        vatSalesAmount: number;
        nonVatSalesAmount: number;
        orderCount: number;
        customerIds: Set<string>;
      }
    >();

    let totalSalesAmount = 0;
    let vatSalesAmount = 0;
    let nonVatSalesAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let dueAmount = 0;
    let overdueAmount = 0;
    let totalCostLkr = 0;

    for (const order of orders) {
      const amount = decimalToNumber(order.totalAmount);
      const orderCost = order.batchAllocations.reduce(
        (sum, allocation) => sum + decimalToNumber(allocation.totalCostLkr),
        0
      );
      const customer = order.customer;
      const current = customerMap.get(order.customerId) ?? {
        customerId: order.customerId,
        customerName: customer?.customerName ?? order.customerName,
        contactPerson:
          customer?.contactPerson ?? order.customerContactPerson ?? null,
        phone: customer?.phone ?? order.customerPhone ?? null,
        email: customer?.email ?? null,
        customerType: customer?.customerType ?? order.customerTypeSnapshot,
        vatNumber:
          customer?.vatNumber ?? order.customerVatNumberSnapshot ?? null,
        vatSalesAmount: 0,
        nonVatSalesAmount: 0,
        totalSalesAmount: 0,
        orderCount: 0,
        lastOrderDate: order.orderDate,
        totalCostLkr: 0,
      };

      current.totalSalesAmount += amount;
      current.totalCostLkr += orderCost;
      current.orderCount += 1;
      if (order.orderDate > current.lastOrderDate) {
        current.lastOrderDate = order.orderDate;
      }

      totalSalesAmount += amount;
      totalCostLkr += orderCost;

      if (order.orderType === "VAT") {
        current.vatSalesAmount += amount;
        vatSalesAmount += amount;
        vatOrderIds.add(order.id);
      } else {
        current.nonVatSalesAmount += amount;
        nonVatSalesAmount += amount;
        nonVatOrderIds.add(order.id);
      }

      if (order.paymentStatus === "PAID") {
        paidAmount += amount;
        paidOrderIds.add(order.id);
      } else if (order.paymentStatus === "DUE") {
        dueAmount += amount;
        dueOrderIds.add(order.id);
      } else if (order.paymentStatus === "OVERDUE") {
        overdueAmount += amount;
        overdueOrderIds.add(order.id);
      } else {
        pendingAmount += amount;
        pendingOrderIds.add(order.id);
      }

      const date = getDateKey(order.orderDate);
      const daily = dailyMap.get(date) ?? {
        date,
        totalSalesAmount: 0,
        vatSalesAmount: 0,
        nonVatSalesAmount: 0,
        orderCount: 0,
        customerIds: new Set<string>(),
      };

      daily.totalSalesAmount += amount;
      daily.orderCount += 1;
      daily.customerIds.add(order.customerId);

      if (order.orderType === "VAT") {
        daily.vatSalesAmount += amount;
      } else {
        daily.nonVatSalesAmount += amount;
      }

      dailyMap.set(date, daily);
      customerMap.set(order.customerId, current);
    }

    const customerSales = Array.from(customerMap.values())
      .map((customer) => ({
        customerId: customer.customerId,
        customerName: customer.customerName,
        contactPerson: customer.contactPerson,
        phone: customer.phone,
        email: customer.email,
        customerType: customer.customerType,
        vatNumber: customer.vatNumber,
        vatSalesAmount: customer.vatSalesAmount,
        nonVatSalesAmount: customer.nonVatSalesAmount,
        totalSalesAmount: customer.totalSalesAmount,
        orderCount: customer.orderCount,
        averageOrderValue:
          customer.orderCount > 0
            ? customer.totalSalesAmount / customer.orderCount
            : 0,
        lastOrderDate: customer.lastOrderDate,
        totalCostLkr: customer.totalCostLkr,
        grossProfitLkr: customer.totalSalesAmount - customer.totalCostLkr,
        grossProfitMarginPercentage:
          customer.totalSalesAmount > 0
            ? ((customer.totalSalesAmount - customer.totalCostLkr) / customer.totalSalesAmount) * 100
            : 0,
      }))
      .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);

    return NextResponse.json({
      success: true,
      data: {
        mode: "FULL_CUSTOMER_SALES",
        summary: {
          totalSalesAmount,
          vatSalesAmount,
          nonVatSalesAmount,
          totalOrderCount: orders.length,
          totalCustomerCount: customerSales.length,
          averageOrderValue:
            orders.length > 0 ? totalSalesAmount / orders.length : 0,
          topCustomerName: customerSales[0]?.customerName ?? null,
          totalCostLkr,
          grossProfitLkr: totalSalesAmount - totalCostLkr,
          grossProfitMarginPercentage:
            totalSalesAmount > 0 ? ((totalSalesAmount - totalCostLkr) / totalSalesAmount) * 100 : 0,
        },
        customerSales,
        orderTypeBreakdown: {
          vatSalesAmount,
          nonVatSalesAmount,
          vatOrderCount: vatOrderIds.size,
          nonVatOrderCount: nonVatOrderIds.size,
        },
        paymentBreakdown: {
          paidAmount,
          pendingAmount,
          dueAmount,
          overdueAmount,
          paidCount: paidOrderIds.size,
          pendingCount: pendingOrderIds.size,
          dueCount: dueOrderIds.size,
          overdueCount: overdueOrderIds.size,
        },
        dailyCustomerSales: Array.from(dailyMap.values())
          .map((daily) => ({
            date: daily.date,
            totalSalesAmount: daily.totalSalesAmount,
            vatSalesAmount: daily.vatSalesAmount,
            nonVatSalesAmount: daily.nonVatSalesAmount,
            orderCount: daily.orderCount,
            customerCount: daily.customerIds.size,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        recentCustomerSales: orders.slice(0, 10).map((order) => ({
          id: order.id,
          orderId: order.orderId,
          vatOrderId: order.vatOrderId,
          nonVatOrderId: order.nonVatOrderId,
          customerId: order.customerId,
          customerName: order.customer?.customerName ?? order.customerName,
          orderType: order.orderType,
          totalAmount: decimalToNumber(order.totalAmount),
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          deliveryStatus: order.deliveryStatus,
          orderStatus: order.orderStatus,
          orderDate: order.orderDate,
          createdAt: order.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch customer sales report:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch customer sales report." },
      { status: 500 }
    );
  }
}
