import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput, parseDateToInput } from "@/lib/date-utils";
import {
  getNextImportNo,
  importDetailInclude,
  importItemCreateData,
  prepareImportItems,
  shipmentData,
  type ImportShipmentInput,
} from "@/lib/imports/import-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED", "REVERSED"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const pageValue = Number(searchParams.get("page") ?? 1);
    const limitValue = Number(searchParams.get("limit") ?? 20);
    const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 100) : 20;
    const q = searchParams.get("q")?.trim();
    const supplierName = searchParams.get("supplierName")?.trim();
    const statusValue = searchParams.get("status");
    const status = STATUSES.includes(statusValue as (typeof STATUSES)[number])
      ? (statusValue as (typeof STATUSES)[number])
      : undefined;
    const dateFrom = parseDateInput(searchParams.get("dateFrom"));
    const dateTo = parseDateToInput(searchParams.get("dateTo"));

    const where: Prisma.ImportShipmentWhereInput = {
      ...(status ? { status } : {}),
      ...(supplierName ? { supplierName: { contains: supplierName, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { importNo: { contains: q, mode: "insensitive" } },
              { supplierName: { contains: q, mode: "insensitive" } },
              { referenceNo: { contains: q, mode: "insensitive" } },
              { containerNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? { importDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };

    const [imports, totalCount, confirmedTotals] = await Promise.all([
      prisma.importShipment.findMany({
        where,
        orderBy: [{ importDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { items: true } } },
      }),
      prisma.importShipment.count({ where }),
      prisma.importShipment.aggregate({
        where: { ...where, status: "CONFIRMED" },
        _sum: {
          totalKg: true,
          totalBags: true,
          totalShipmentCostLkr: true,
          totalExpectedRevenueLkr: true,
          totalExpectedProfitLkr: true,
        },
      }),
    ]);

    const sum = confirmedTotals._sum;
    const expectedRevenue = Number(sum.totalExpectedRevenueLkr ?? 0);
    const expectedProfit = Number(sum.totalExpectedProfitLkr ?? 0);

    return NextResponse.json({
      success: true,
      data: imports.map(({ _count, ...shipment }) => ({
        ...shipment,
        itemCount: _count.items,
      })),
      summary: {
        totalKg: Number(sum.totalKg ?? 0),
        totalBags: Number(sum.totalBags ?? 0),
        totalShipmentCostLkr: Number(sum.totalShipmentCostLkr ?? 0),
        totalExpectedRevenueLkr: expectedRevenue,
        totalExpectedProfitLkr: expectedProfit,
        expectedProfitMarginPercentage:
          expectedRevenue > 0 ? (expectedProfit / expectedRevenue) * 100 : 0,
      },
      meta: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error("Failed to list imports:", error);
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json(
      { success: false, message: unauthorized ? "Unauthorized" : "Failed to load imports." },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const input = (await request.json()) as ImportShipmentInput;

    const shipment = await prisma.$transaction(async (tx) => {
      const prepared = await prepareImportItems(tx, input.items);
      const importNo = await getNextImportNo(tx);
      return tx.importShipment.create({
        data: {
          importNo,
          ...shipmentData(input, prepared.totals),
          createdByUserId: currentUser.id,
          createdByRole: currentUser.role,
          items: { create: prepared.items.map(importItemCreateData) },
        },
        include: importDetailInclude,
      });
    });

    return NextResponse.json({ success: true, data: shipment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create import:", error);
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create import." },
      { status: unauthorized ? 401 : 400 }
    );
  }
}
