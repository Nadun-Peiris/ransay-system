import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput, parseDateToInput } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

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
    const productId = searchParams.get("productId")?.trim();
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
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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
            batchAllocations: {
              where: { restoredAt: null },
              select: { totalCostLkr: true },
            },
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
      totalCostLkr: number;
      grossProfitLkr: number;
      paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
      orderDate: Date;
      createdAt: Date;
    }[] = [];

    let totalSalesAmount = 0;
    let vatSalesAmount = 0;
    let nonVatSalesAmount = 0;
    let totalBagsSold = 0;
    let totalKgSold = 0;
    let totalCostLkr = 0;

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
        const itemCost = item.batchAllocations.reduce(
          (sum, allocation) => sum + decimalToNumber(allocation.totalCostLkr),
          0
        );
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
          totalCostLkr: 0,
        };

        current.totalSalesAmount += itemSalesAmount;
        current.orderIds.add(order.id);
        current.quantitySold += bagsSold;
        current.bagsSold += bagsSold;
        current.kgSold += kgSold;
        current.totalCostLkr += itemCost;

        totalSalesAmount += itemSalesAmount;
        totalBagsSold += bagsSold;
        totalKgSold += kgSold;
        totalCostLkr += itemCost;
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
          totalCostLkr: itemCost,
          grossProfitLkr: itemSalesAmount - itemCost,
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
        totalCostLkr: product.totalCostLkr,
        grossProfitLkr: product.totalSalesAmount - product.totalCostLkr,
        grossProfitMarginPercentage:
          product.totalSalesAmount > 0
            ? ((product.totalSalesAmount - product.totalCostLkr) / product.totalSalesAmount) * 100
            : 0,
      }))
      .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);

    return NextResponse.json({
      success: true,
      data: {
        mode: "FULL_PRODUCT_SALES",
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
          totalCostLkr,
          grossProfitLkr: totalSalesAmount - totalCostLkr,
          grossProfitMarginPercentage:
            totalSalesAmount > 0 ? ((totalSalesAmount - totalCostLkr) / totalSalesAmount) * 100 : 0,
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
          .sort((a, b) => {
            const orderDateSort = b.orderDate.getTime() - a.orderDate.getTime();

            if (orderDateSort !== 0) {
              return orderDateSort;
            }

            return b.createdAt.getTime() - a.createdAt.getTime();
          })
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
