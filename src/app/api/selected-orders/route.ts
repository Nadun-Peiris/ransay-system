import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatSelectedId(value: number) {
  return `SEL-${String(value).padStart(4, "0")}`;
}

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const FULFILLMENT_STATUSES = ["UNFULFILLED", "FULFILLED"] as const;
const DELIVERY_STATUSES = [
  "NOT_DISPATCHED",
  "DISPATCHED",
  "DELIVERED",
] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

function getEnumParam<T extends readonly string[]>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: T
): T[number] | undefined {
  const value = searchParams.get(key);

  if (value && allowedValues.includes(value)) {
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
    await requireCurrentUser(request);

    const { searchParams } = new URL(request.url);

    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    const offset = (safePage - 1) * safeLimit;
    const q = searchParams.get("q")?.trim();
    const orderType = getEnumParam(searchParams, "orderType", ORDER_TYPES);
    const paymentStatus = getEnumParam(
      searchParams,
      "paymentStatus",
      PAYMENT_STATUSES
    );
    const fulfillmentStatus = getEnumParam(
      searchParams,
      "fulfillmentStatus",
      FULFILLMENT_STATUSES
    );
    const deliveryStatus = getEnumParam(
      searchParams,
      "deliveryStatus",
      DELIVERY_STATUSES
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
        {
          OR: [
            {
              createdByRole: "ADMIN",
            },
            {
              createdByRole: "SUPERADMIN",
              orderType: "VAT",
            },
            {
              createdByRole: "SUPERADMIN",
              orderType: "NON_VAT",
              isSelected: true,
            },
          ],
        },
        ...(q
          ? [
              {
                OR: [
                  { orderId: { contains: q, mode: "insensitive" as const } },
                  { vatOrderId: { contains: q, mode: "insensitive" as const } },
                  {
                    nonVatOrderId: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    customerName: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    customerPhone: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
        ...(orderType ? [{ orderType }] : []),
        ...(paymentStatus ? [{ paymentStatus }] : []),
        ...(fulfillmentStatus ? [{ fulfillmentStatus }] : []),
        ...(deliveryStatus ? [{ deliveryStatus }] : []),
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

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [
          {
            orderDate: "desc",
          },
          {
            id: "desc",
          },
        ],
        skip: offset,
        take: safeLimit,
        include: {
          items: true,
        },
      }),

      prisma.order.count({
        where,
      }),
    ]);

    const formattedOrders = orders.map((order, index) => ({
      selectedVisibleId: formatSelectedId(offset + index + 1),

      id: order.id,
      orderId: order.orderId,
      vatOrderId: order.vatOrderId,
      nonVatOrderId: order.nonVatOrderId,

      createdByRole: order.createdByRole,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderType: order.orderType,
      isSelected: order.isSelected,

      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      deliveryAmount: Number(order.deliveryAmount),
      vatAmount: Number(order.vatAmount),
      totalAmount: Number(order.totalAmount),

      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      deliveryStatus: order.deliveryStatus,

      orderDate: order.orderDate,
      createdAt: order.createdAt,

      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantityBags: Number(item.quantityBags),
        quantityKg: Number(item.quantityKg),
        pricePerKg: Number(item.pricePerKg),
        lineTotal: Number(item.lineTotal),
      })),
    }));

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      meta: {
        page: safePage,
        limit: safeLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch selected orders:", error);

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
          error instanceof Error
            ? error.message
            : "Failed to fetch selected orders.",
      },
      { status: 500 }
    );
  }
}
