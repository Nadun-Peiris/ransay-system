import type { Prisma } from "@/generated/prisma/client";
import {
  calculateImportItem,
  calculateImportShipmentTotals,
} from "@/lib/imports/import-calculations";

export type ImportItemInput = {
  productId?: string;
  quantityKg?: number;
  kgPerBag?: number;
  usdAmountPerKg?: number;
  exchangeRateLkrUsd?: number;
  undiyalPaidLkr?: number;
  dutyTaxLkr?: number;
  clearingChargesLkr?: number;
  miscellaneousLkr?: number;
  sellingPricePerKgLkr?: number;
};

export type ImportShipmentInput = {
  importDate?: string;
  supplierName?: string | null;
  referenceNo?: string | null;
  containerNo?: string | null;
  notes?: string | null;
  items?: ImportItemInput[];
};

export function parseImportDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Import date is invalid.");
  return date;
}

export async function prepareImportItems(
  tx: Prisma.TransactionClient,
  inputs: ImportItemInput[] | undefined
) {
  if (!inputs?.length) throw new Error("At least one import item is required.");

  const productIds = inputs.map((item) => item.productId?.trim()).filter(Boolean) as string[];
  if (productIds.length !== inputs.length) throw new Error("Product is required for every item.");

  const products = await tx.product.findMany({
    where: { id: { in: [...new Set(productIds)] }, isActive: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const items = inputs.map((input) => {
    const product = productMap.get(input.productId as string);
    if (!product) throw new Error("One or more products were not found or are inactive.");

    const calculated = calculateImportItem({
      quantityKg: Number(input.quantityKg),
      kgPerBag: input.kgPerBag == null ? Number(product.kgPerBag) : Number(input.kgPerBag),
      usdAmountPerKg: Number(input.usdAmountPerKg ?? 0),
      exchangeRateLkrUsd: Number(input.exchangeRateLkrUsd ?? 0),
      undiyalPaidLkr: Number(input.undiyalPaidLkr ?? 0),
      dutyTaxLkr: Number(input.dutyTaxLkr ?? 0),
      clearingChargesLkr: Number(input.clearingChargesLkr ?? 0),
      miscellaneousLkr: Number(input.miscellaneousLkr ?? 0),
      sellingPricePerKgLkr:
        input.sellingPricePerKgLkr == null
          ? Number(product.defaultSellingPricePerKg)
          : Number(input.sellingPricePerKgLkr),
    });

    return { product, calculated };
  });

  return { items, totals: calculateImportShipmentTotals(items.map((item) => item.calculated)) };
}

export function importItemCreateData(
  item: Awaited<ReturnType<typeof prepareImportItems>>["items"][number]
) {
  return { productId: item.product.id, ...item.calculated };
}

export async function getNextImportNo(tx: Prisma.TransactionClient) {
  const sequence = await tx.idSequence.upsert({
    where: { key: "IMPORT" },
    create: { key: "IMPORT", currentValue: 1 },
    update: { currentValue: { increment: 1 } },
    select: { currentValue: true },
  });
  return `IMP-${String(sequence.currentValue).padStart(4, "0")}`;
}

export function shipmentData(input: ImportShipmentInput, totals: ReturnType<typeof calculateImportShipmentTotals>) {
  return {
    importDate: parseImportDate(input.importDate),
    supplierName: input.supplierName?.trim() || null,
    referenceNo: input.referenceNo?.trim() || null,
    containerNo: input.containerNo?.trim() || null,
    notes: input.notes?.trim() || null,
    ...totals,
  };
}

export const importDetailInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: { select: { id: true, productName: true, sku: true, kgPerBag: true, defaultSellingPricePerKg: true } },
      stockBatch: true,
    },
  },
  stockBatches: { orderBy: [{ importDate: "asc" as const }, { createdAt: "asc" as const }] },
  stockMovements: { orderBy: { createdAt: "desc" as const } },
};
