import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

type ProductSalesMode = "FULL_PRODUCT_SALES" | "SELECTED_PRODUCT_SALES";

type ProductSalesRow = {
  productId: string;
  productName: string;
  sku: string | null;
  vatSalesAmount: number;
  nonVatSalesAmount: number;
  totalSalesAmount: number;
  orderIds: Set<string>;
  quantitySold: number;
  bagsSold: number;
  kgSold: number;
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
    const mode: ProductSalesMode =
      currentUser.role === "SUPERADMIN"
        ? "FULL_PRODUCT_SALES"
        : "SELECTED_PRODUCT_SALES";

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
    const productId = searchParams.get("productId")?.trim();
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
        ...(productId
          ? [
              {
                items: {
                  some: {
                    productId,
                  },
                },
              },
            ]
          : []),
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
        customerName: true,
        orderType: true,
        paymentStatus: true,
        orderDate: true,
        createdAt: true,
        items: {
          where: productId ? { productId } : undefined,
          select: {
            productId: true,
            productName: true,
            sku: true,
            quantityBags: true,
            quantityKg: true,
            pricePerKg: true,
            lineTotal: true,
          },
        },
      },
    });

    const productMap = new Map<string, ProductSalesRow>();
    const orderIds = new Set<string>();
    const vatOrderIds = new Set<string>();
    const nonVatOrderIds = new Set<string>();
    const dailyMap = new Map<
      string,
      {
        date: string;
        totalSalesAmount: number;
        vatSalesAmount: number;
        nonVatSalesAmount: number;
        bagsSold: number;
        kgSold: number;
        orderIds: Set<string>;
      }
    >();
    const recentLineItems: {
      orderId: string;
      orderDisplayId: string;
      productName: string;
      customerName: string;
      orderType: "VAT" | "NON_VAT";
      quantitySold: number;
      bagsSold: number;
      kgSold: number;
      totalAmount: number;
      paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
      orderDate: Date;
      createdAt: Date;
    }[] = [];

    let totalSalesAmount = 0;
    let vatSalesAmount = 0;
    let nonVatSalesAmount = 0;
    let totalBagsSold = 0;
    let totalKgSold = 0;

    for (const order of orders) {
      if (order.items.length === 0) {
        continue;
      }

      orderIds.add(order.id);
      if (order.orderType === "VAT") {
        vatOrderIds.add(order.id);
      } else {
        nonVatOrderIds.add(order.id);
      }

      const date = getDateKey(order.orderDate);
      const daily = dailyMap.get(date) ?? {
        date,
        totalSalesAmount: 0,
        vatSalesAmount: 0,
        nonVatSalesAmount: 0,
        bagsSold: 0,
        kgSold: 0,
        orderIds: new Set<string>(),
      };
      daily.orderIds.add(order.id);

      for (const item of order.items) {
        const bagsSold = decimalToNumber(item.quantityBags);
        const kgSold = decimalToNumber(item.quantityKg);
        const itemSalesAmount =
          decimalToNumber(item.lineTotal) ||
          kgSold * decimalToNumber(item.pricePerKg);
        const current = productMap.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          vatSalesAmount: 0,
          nonVatSalesAmount: 0,
          totalSalesAmount: 0,
          orderIds: new Set<string>(),
          quantitySold: 0,
          bagsSold: 0,
          kgSold: 0,
        };

        current.totalSalesAmount += itemSalesAmount;
        current.orderIds.add(order.id);
        current.quantitySold += bagsSold;
        current.bagsSold += bagsSold;
        current.kgSold += kgSold;

        totalSalesAmount += itemSalesAmount;
        totalBagsSold += bagsSold;
        totalKgSold += kgSold;
        daily.totalSalesAmount += itemSalesAmount;
        daily.bagsSold += bagsSold;
        daily.kgSold += kgSold;

        if (order.orderType === "VAT") {
          current.vatSalesAmount += itemSalesAmount;
          vatSalesAmount += itemSalesAmount;
          daily.vatSalesAmount += itemSalesAmount;
        } else {
          current.nonVatSalesAmount += itemSalesAmount;
          nonVatSalesAmount += itemSalesAmount;
          daily.nonVatSalesAmount += itemSalesAmount;
        }

        productMap.set(item.productId, current);

        recentLineItems.push({
          orderId: order.id,
          orderDisplayId: order.orderId,
          productName: item.productName,
          customerName: order.customerName,
          orderType: order.orderType,
          quantitySold: bagsSold,
          bagsSold,
          kgSold,
          totalAmount: itemSalesAmount,
          paymentStatus: order.paymentStatus,
          orderDate: order.orderDate,
          createdAt: order.createdAt,
        });
      }

      dailyMap.set(date, daily);
    }

    const productSales = Array.from(productMap.values())
      .map((product) => ({
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        vatSalesAmount: product.vatSalesAmount,
        nonVatSalesAmount: product.nonVatSalesAmount,
        totalSalesAmount: product.totalSalesAmount,
        orderCount: product.orderIds.size,
        quantitySold: product.quantitySold,
        bagsSold: product.bagsSold,
        kgSold: product.kgSold,
        averageSellingPrice:
          product.kgSold > 0 ? product.totalSalesAmount / product.kgSold : 0,
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
          totalOrderCount: orderIds.size,
          totalQuantitySold: totalBagsSold,
          totalBagsSold,
          totalKgSold,
          averageSellingPrice:
            totalKgSold > 0 ? totalSalesAmount / totalKgSold : 0,
          topSellingProductName: productSales[0]?.productName ?? null,
        },
        productSales,
        orderTypeBreakdown: {
          vatSalesAmount,
          nonVatSalesAmount,
          vatOrderCount: vatOrderIds.size,
          nonVatOrderCount: nonVatOrderIds.size,
        },
        dailyProductSales: Array.from(dailyMap.values())
          .map((daily) => ({
            date: daily.date,
            totalSalesAmount: daily.totalSalesAmount,
            vatSalesAmount: daily.vatSalesAmount,
            nonVatSalesAmount: daily.nonVatSalesAmount,
            bagsSold: daily.bagsSold,
            kgSold: daily.kgSold,
            orderCount: daily.orderIds.size,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        recentProductSales: recentLineItems
          .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
          .slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Failed to fetch product sales report:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch product sales report." },
      { status: 500 }
    );
  }
}
