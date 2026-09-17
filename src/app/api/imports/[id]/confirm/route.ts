import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { importDetailInclude } from "@/lib/imports/import-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;
    const shipment = await prisma.$transaction(async (tx) => {
      const current = await tx.importShipment.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, stockBatches: { select: { id: true } } },
      });
      if (!current) throw new Error("Import not found.");
      if (current.status !== "DRAFT") throw new Error("Only a draft import can be confirmed.");
      if (!current.items.length) throw new Error("Import must have at least one item.");
      if (current.stockBatches.length) throw new Error("Stock batches already exist for this import.");

      for (const [index, item] of current.items.entries()) {
        const batch = await tx.stockBatch.create({
          data: {
            productId: item.productId,
            importShipmentId: current.id,
            importItemId: item.id,
            batchNo: `${current.importNo}-${String(index + 1).padStart(3, "0")}`,
            importDate: current.importDate,
            initialKg: item.quantityKg,
            initialBags: item.quantityBags,
            remainingKg: item.quantityKg,
            remainingBags: item.quantityBags,
            kgPerBag: item.kgPerBag,
            costPerKgLkr: item.costPerKgLkr,
            costPerBagLkr: item.costPerBagLkr,
          },
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stockKg: { increment: item.quantityKg }, stockBags: { increment: item.quantityBags } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            importShipmentId: current.id,
            stockBatchId: batch.id,
            movementType: "IMPORT_IN",
            quantityKg: item.quantityKg,
            quantityBags: item.quantityBags,
            createdByUserId: currentUser.id,
            reason: `Import confirmed: ${current.importNo}`,
          },
        });
      }

      await tx.importShipment.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedByUserId: currentUser.id },
      });
      return tx.importShipment.findUniqueOrThrow({ where: { id }, include: importDetailInclude });
    });
    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to confirm import." }, { status: unauthorized ? 401 : 400 });
  }
}
