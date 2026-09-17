import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatProduct(product: {
  id: string;
  productName: string;
  sku: string | null;
  kgPerBag: Prisma.Decimal;
  stockBags: Prisma.Decimal;
  stockKg: Prisma.Decimal;
  committedBags: Prisma.Decimal;
  committedKg: Prisma.Decimal;
  unavailableBags: Prisma.Decimal;
  unavailableKg: Prisma.Decimal;
  defaultSellingPricePerKg: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  stockBatches: { remainingKg: Prisma.Decimal; costPerKgLkr: Prisma.Decimal }[];
  _count: { stockBatches: number };
}) {
  const onHandBags = Number(product.stockBags);
  const onHandKg = Number(product.stockKg);
  const committedBags = Number(product.committedBags);
  const committedKg = Number(product.committedKg);
  const unavailableBags = Number(product.unavailableBags);
  const unavailableKg = Number(product.unavailableKg);
  const batchRemainingKg = product.stockBatches.reduce(
    (sum, batch) => sum + Number(batch.remainingKg),
    0
  );
  const stockValue = product.stockBatches.reduce(
    (sum, batch) => sum + Number(batch.remainingKg) * Number(batch.costPerKgLkr),
    0
  );

  return {
    id: product.id,
    productName: product.productName,
    sku: product.sku,
    kgPerBag: Number(product.kgPerBag),
    stockBags: onHandBags,
    stockKg: onHandKg,
    onHandBags,
    onHandKg,
    committedBags,
    committedKg,
    unavailableBags,
    unavailableKg,
    availableBags: onHandBags - committedBags - unavailableBags,
    availableKg: onHandKg - committedKg - unavailableKg,
    defaultSellingPricePerKg: Number(product.defaultSellingPricePerKg),
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    availableBatchCount: product.stockBatches.length,
    averageCostPerKg: batchRemainingKg > 0 ? stockValue / batchRemainingKg : 0,
    stockValue,
    expectedProfitIfSold:
      batchRemainingKg * Number(product.defaultSellingPricePerKg) - stockValue,
    hasLegacyStock: onHandKg > 0 && product._count.stockBatches === 0,
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
    const productId = searchParams.get("productId")?.trim();
    const batchQ = searchParams.get("batchQ")?.trim();
    const batchStatus = searchParams.get("batchStatus");

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(q
        ? {
            OR: [
              { productName: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [
          {
            productName: "asc",
          },
          {
            id: "asc",
          },
        ],
        skip: offset,
        take: safeLimit,
        include: {
          stockBatches: {
            where: { status: "ACTIVE", remainingKg: { gt: 0 } },
            select: { remainingKg: true, costPerKgLkr: true },
          },
          _count: { select: { stockBatches: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const batches = await prisma.stockBatch.findMany({
      where: {
        ...(productId ? { productId } : {}),
        ...(batchStatus === "ACTIVE" || batchStatus === "DEPLETED" || batchStatus === "REVERSED"
          ? { status: batchStatus }
          : {}),
        ...(batchQ
          ? {
              OR: [
                { batchNo: { contains: batchQ, mode: "insensitive" } },
                { importShipment: { importNo: { contains: batchQ, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ importDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        product: { select: { id: true, productName: true, sku: true } },
        importShipment: { select: { id: true, importNo: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: products.map(formatProduct),
      batches: batches.map((batch) => ({
        ...batch,
        initialKg: Number(batch.initialKg),
        initialBags: Number(batch.initialBags),
        remainingKg: Number(batch.remainingKg),
        remainingBags: Number(batch.remainingBags),
        kgPerBag: Number(batch.kgPerBag),
        costPerKgLkr: Number(batch.costPerKgLkr),
        costPerBagLkr: Number(batch.costPerBagLkr),
        stockValue: Number(batch.remainingKg) * Number(batch.costPerKgLkr),
      })),
      meta: {
        page: safePage,
        limit: safeLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch stocks:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch stocks.",
      },
      { status: 500 }
    );
  }
}
