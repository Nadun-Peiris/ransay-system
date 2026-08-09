import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UpdateProductInput = {
  productName?: string;
  sku?: string | null;
  kgPerBag?: number;
  defaultSellingPricePerKg?: number;
  isActive?: boolean;
};

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

function formatMovement(movement: {
  id: string;
  movementType: string;
  quantityBags: Prisma.Decimal;
  quantityKg: Prisma.Decimal;
  reason: string | null;
  createdAt: Date;
  order: { id: string; orderId: string } | null;
  createdByUser: { id: string; name: string; role: string };
}) {
  return {
    id: movement.id,
    movementType: movement.movementType,
    quantityBags: Number(movement.quantityBags),
    quantityKg: Number(movement.quantityKg),
    reason: movement.reason,
    createdAt: movement.createdAt,
    order: movement.order,
    createdByUser: movement.createdByUser,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        stockMovements: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            order: {
              select: {
                id: true,
                orderId: true,
              },
            },
            createdByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...formatProduct(product),
        stockMovements: product.stockMovements.map(formatMovement),
      },
    });
  } catch (error) {
    console.error("Failed to fetch product:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch product.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;
    const body = (await request.json()) as UpdateProductInput;

    const data: Prisma.ProductUpdateInput = {};

    if (body.productName !== undefined) {
      const productName = body.productName.trim();

      if (!productName) {
        return NextResponse.json(
          { success: false, message: "Product name is required." },
          { status: 400 }
        );
      }

      data.productName = productName;
    }

    if (body.sku !== undefined) {
      data.sku = body.sku?.trim() || null;
    }

    if (body.kgPerBag !== undefined) {
      const kgPerBag = Number(body.kgPerBag);

      if (!Number.isFinite(kgPerBag) || kgPerBag <= 0) {
        return NextResponse.json(
          { success: false, message: "Kg per bag must be greater than 0." },
          { status: 400 }
        );
      }

      data.kgPerBag = kgPerBag;
    }

    if (body.defaultSellingPricePerKg !== undefined) {
      const defaultSellingPricePerKg = Number(body.defaultSellingPricePerKg);

      if (
        !Number.isFinite(defaultSellingPricePerKg) ||
        defaultSellingPricePerKg < 0
      ) {
        return NextResponse.json(
          { success: false, message: "Default price cannot be negative." },
          { status: 400 }
        );
      }

      data.defaultSellingPricePerKg = defaultSellingPricePerKg;
    }

    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: formatProduct(product),
    });
  } catch (error) {
    console.error("Failed to update product:", error);

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
          error instanceof Error ? error.message : "Failed to update product.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const product = await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: formatProduct(product),
    });
  } catch (error) {
    console.error("Failed to deactivate product:", error);

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
            : "Failed to deactivate product.",
      },
      { status: 500 }
    );
  }
}
