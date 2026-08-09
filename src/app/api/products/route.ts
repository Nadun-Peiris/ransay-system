import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CreateProductInput = {
  productName?: string;
  sku?: string | null;
  kgPerBag?: number;
  defaultSellingPricePerKg?: number;
  openingStockBags?: number;
};

function getPagination(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

  return {
    searchParams,
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

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
}) {
  const onHandBags = Number(product.stockBags);
  const onHandKg = Number(product.stockKg);
  const committedBags = Number(product.committedBags);
  const committedKg = Number(product.committedKg);
  const unavailableBags = Number(product.unavailableBags);
  const unavailableKg = Number(product.unavailableKg);

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
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser(request);

    const { searchParams, page, limit, offset } = getPagination(request);
    const q = searchParams.get("q")?.trim();

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
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products.map(formatProduct),
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch products.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const body = (await request.json()) as CreateProductInput;

    const productName = body.productName?.trim();
    const sku = body.sku?.trim() || null;
    const kgPerBag = Number(body.kgPerBag);
    const defaultSellingPricePerKg = Number(body.defaultSellingPricePerKg ?? 0);
    const openingStockBags = Number(body.openingStockBags ?? 0);

    if (!productName) {
      return NextResponse.json(
        { success: false, message: "Product name is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(kgPerBag) || kgPerBag <= 0) {
      return NextResponse.json(
        { success: false, message: "Kg per bag must be greater than 0." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(defaultSellingPricePerKg) ||
      defaultSellingPricePerKg < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Default price cannot be negative." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(openingStockBags) || openingStockBags < 0) {
      return NextResponse.json(
        { success: false, message: "Opening stock cannot be negative." },
        { status: 400 }
      );
    }

    const openingStockKg = openingStockBags * kgPerBag;

    const createdProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          productName,
          sku,
          kgPerBag,
          defaultSellingPricePerKg,
          stockBags: openingStockBags,
          stockKg: openingStockKg,
        },
      });

      if (openingStockBags > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: "STOCK_IN",
            quantityBags: openingStockBags,
            quantityKg: openingStockKg,
            reason: "Opening stock",
            createdByUserId: currentUser.id,
          },
        });
      }

      return product;
    });

    return NextResponse.json(
      {
        success: true,
        data: formatProduct(createdProduct),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create product:", error);

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
          error instanceof Error ? error.message : "Failed to create product.",
      },
      { status: 500 }
    );
  }
}
