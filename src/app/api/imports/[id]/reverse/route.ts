import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { importDetailInclude } from "@/lib/imports/import-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim();
    if (!reason) return NextResponse.json({ success: false, message: "Reverse reason is required." }, { status: 400 });

    const shipment = await prisma.$transaction(async (tx) => {
      const current = await tx.importShipment.findUnique({
        where: { id },
        include: { stockBatches: { include: { allocations: { select: { id: true } } } } },
      });
      if (!current) throw new Error("Import not found.");
      if (current.status !== "CONFIRMED") throw new Error("Only a confirmed import can be reversed.");
      if (current.stockBatches.some((batch) => batch.allocations.length > 0 || Number(batch.remainingKg) < Number(batch.initialKg))) {
        throw new Error("Cannot reverse this import because stock from this import has already been used in orders.");
      }

      for (const batch of current.stockBatches) {
        const remainingKg = Number(batch.remainingKg);
        const remainingBags = Number(batch.remainingBags);
        await tx.product.update({
          where: { id: batch.productId },
          data: { stockKg: { decrement: batch.remainingKg }, stockBags: { decrement: batch.remainingBags } },
        });
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: { remainingKg: 0, remainingBags: 0, status: "REVERSED" },
        });
        await tx.stockMovement.create({
          data: {
            productId: batch.productId,
            importShipmentId: current.id,
            stockBatchId: batch.id,
            movementType: "IMPORT_REVERSE",
            quantityKg: -remainingKg,
            quantityBags: -remainingBags,
            createdByUserId: currentUser.id,
            reason,
          },
        });
      }
      await tx.importShipment.update({
        where: { id },
        data: { status: "REVERSED", reversedAt: new Date(), reversedByUserId: currentUser.id, reverseReason: reason },
      });
      return tx.importShipment.findUniqueOrThrow({ where: { id }, include: importDetailInclude });
    });
    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to reverse import." }, { status: unauthorized ? 401 : 400 });
  }
}
