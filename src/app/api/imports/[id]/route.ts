import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  importDetailInclude,
  importItemCreateData,
  prepareImportItems,
  shipmentData,
  type ImportShipmentInput,
} from "@/lib/imports/import-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;
    const shipment = await prisma.importShipment.findUnique({ where: { id }, include: importDetailInclude });
    if (!shipment) return NextResponse.json({ success: false, message: "Import not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json({ success: false, message: unauthorized ? "Unauthorized" : "Failed to load import." }, { status: unauthorized ? 401 : 500 });
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;
    const input = (await request.json()) as ImportShipmentInput;
    const shipment = await prisma.$transaction(async (tx) => {
      const existing = await tx.importShipment.findUnique({ where: { id }, select: { status: true } });
      if (!existing) throw new Error("Import not found.");
      if (existing.status !== "DRAFT") throw new Error("Only draft imports can be edited.");
      const prepared = await prepareImportItems(tx, input.items);
      await tx.importItem.deleteMany({ where: { importShipmentId: id } });
      return tx.importShipment.update({
        where: { id },
        data: {
          ...shipmentData(input, prepared.totals),
          items: { create: prepared.items.map(importItemCreateData) },
        },
        include: importDetailInclude,
      });
    });
    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to update import." }, { status: unauthorized ? 401 : 400 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;
    const shipment = await prisma.$transaction(async (tx) => {
      const existing = await tx.importShipment.findUnique({ where: { id }, select: { status: true } });
      if (!existing) throw new Error("Import not found.");
      if (existing.status !== "DRAFT") throw new Error("Only draft imports can be cancelled.");
      return tx.importShipment.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByUserId: currentUser.id },
      });
    });
    return NextResponse.json({ success: true, data: shipment });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to cancel import." }, { status: unauthorized ? 401 : 400 });
  }
}
