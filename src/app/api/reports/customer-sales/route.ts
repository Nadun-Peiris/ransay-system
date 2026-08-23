import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

type CustomerSalesMode = "FULL_CUSTOMER_SALES" | "SELECTED_CUSTOMER_SALES";

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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const mode: CustomerSalesMode =
      currentUser.role === "SUPERADMIN"
        ? "FULL_CUSTOMER_SALES"
        : "SELECTED_CUSTOMER_SALES";

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

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      orderStatus: {
        notIn: ["DELETED", "CANCELLED"],
      },
      AND: [
        ...(currentUser.role === "SUPERADMIN"
          ? []
          : [selectedOrdersVisibilityFilter]),
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
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
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

    for (const order of orders) {
      const amount = decimalToNumber(order.totalAmount);
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
      };

      current.totalSalesAmount += amount;
      current.orderCount += 1;
      if (order.orderDate > current.lastOrderDate) {
        current.lastOrderDate = order.orderDate;
      }

      totalSalesAmount += amount;

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
      }))
      .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);

    return NextResponse.json({
      success: true,
      data: {
        mode,
        summary: {
          totalSalesAmount,
          vatSalesAmount,
          nonVatSalesAmount,
          totalOrderCount: orders.length,
          totalCustomerCount: customerSales.length,
          averageOrderValue:
            orders.length > 0 ? totalSalesAmount / orders.length : 0,
          topCustomerName: customerSales[0]?.customerName ?? null,
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
