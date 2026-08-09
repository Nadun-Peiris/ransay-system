import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type StockAdjustmentInput = {
  productId?: string;
  movementType?: "STOCK_IN" | "STOCK_OUT" | "STOCK_ADJUSTMENT";
  quantityBags?: number;
  newStockBags?: number;
  reason?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const body = (await request.json()) as StockAdjustmentInput;

    const productId = body.productId;
    const movementType = body.movementType;
    const reason = body.reason?.trim() || null;

    if (!productId) {
      return NextResponse.json(
        { success: false, message: "Product is required." },
        { status: 400 }
      );
    }

    if (
      movementType !== "STOCK_IN" &&
      movementType !== "STOCK_OUT" &&
      movementType !== "STOCK_ADJUSTMENT"
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid stock movement type." },
        { status: 400 }
      );
    }

    if (movementType === "STOCK_ADJUSTMENT" && !reason) {
      return NextResponse.json(
        { success: false, message: "Reason is required for stock adjustment." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: {
          id: productId,
        },
      });

      if (!product || !product.isActive) {
        throw new Error("Product not found or inactive.");
      }

      const kgPerBag = Number(product.kgPerBag);
      const currentStockBags = Number(product.stockBags);
      const committedBags = Number(product.committedBags);
      const unavailableBags = Number(product.unavailableBags);
      const minimumOnHandBags = committedBags + unavailableBags;
      const availableBags = currentStockBags - minimumOnHandBags;
      let quantityBags = Number(body.quantityBags ?? 0);
      let nextStockBags = currentStockBags;

      if (movementType === "STOCK_ADJUSTMENT") {
        const newStockBags = Number(body.newStockBags);

        if (!Number.isFinite(newStockBags) || newStockBags < 0) {
          throw new Error("New stock bags must be zero or greater.");
        }

        if (newStockBags < minimumOnHandBags) {
          throw new Error(
            "On hand stock cannot be lower than committed plus unavailable stock."
          );
        }

        quantityBags = newStockBags - currentStockBags;
        nextStockBags = newStockBags;
      } else {
        if (!Number.isFinite(quantityBags) || quantityBags <= 0) {
          throw new Error("Quantity bags must be greater than 0.");
        }

        if (movementType === "STOCK_OUT") {
          if (quantityBags > availableBags) {
            throw new Error("Not enough available stock.");
          }

          quantityBags = -quantityBags;
        }

        nextStockBags = currentStockBags + quantityBags;
      }

      const quantityKg = quantityBags * kgPerBag;
      const nextStockKg = nextStockBags * kgPerBag;

      const updatedProduct = await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          stockBags: nextStockBags,
          stockKg: nextStockKg,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType,
          quantityBags,
          quantityKg,
          reason:
            reason ||
            (movementType === "STOCK_IN" ? "Manual stock in" : "Manual stock out"),
          createdByUserId: currentUser.id,
        },
      });

      return {
        product: {
          id: updatedProduct.id,
          productName: updatedProduct.productName,
          sku: updatedProduct.sku,
          kgPerBag: Number(updatedProduct.kgPerBag),
          stockBags: Number(updatedProduct.stockBags),
          stockKg: Number(updatedProduct.stockKg),
          onHandBags: Number(updatedProduct.stockBags),
          onHandKg: Number(updatedProduct.stockKg),
          committedBags: Number(updatedProduct.committedBags),
          committedKg: Number(updatedProduct.committedKg),
          unavailableBags: Number(updatedProduct.unavailableBags),
          unavailableKg: Number(updatedProduct.unavailableKg),
          availableBags:
            Number(updatedProduct.stockBags) -
            Number(updatedProduct.committedBags) -
            Number(updatedProduct.unavailableBags),
          availableKg:
            Number(updatedProduct.stockKg) -
            Number(updatedProduct.committedKg) -
            Number(updatedProduct.unavailableKg),
          defaultSellingPricePerKg: Number(
            updatedProduct.defaultSellingPricePerKg
          ),
          isActive: updatedProduct.isActive,
          createdAt: updatedProduct.createdAt,
          updatedAt: updatedProduct.updatedAt,
        },
        movement: {
          id: movement.id,
          movementType: movement.movementType,
          quantityBags: Number(movement.quantityBags),
          quantityKg: Number(movement.quantityKg),
          reason: movement.reason,
          createdAt: movement.createdAt,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to adjust stock:", error);

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
          error instanceof Error ? error.message : "Failed to adjust stock.",
      },
      { status: 400 }
    );
  }
}
