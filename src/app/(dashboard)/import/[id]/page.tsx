"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import {
  formatCurrencyLkr,
  formatCurrencyUsd,
  formatDate,
  formatNumber,
  formatPercentage,
} from "@/lib/formatters";

type ImportItem = {
  id: string;
  product: { productName: string; sku: string | null };
  quantityKg: number;
  kgPerBag: number;
  quantityBags: number;
  usdAmountPerKg: number;
  amountPaidUsd: number;
  exchangeRateLkrUsd: number;
  usdConvertedLkr: number;
  undiyalPaidLkr: number;
  dutyTaxLkr: number;
  bankProcessingChargesLkr: number;
  clearingChargesLkr: number;
  miscellaneousLkr: number;
  finalItemCostLkr: number;
  costPerKgLkr: number;
  costPerBagLkr: number;
  sellingPricePerKgLkr: number;
  expectedRevenueLkr: number;
  expectedProfitLkr: number;
  expectedProfitMarginPercentage: number;
  stockBatch: { batchNo: string; remainingKg: number } | null;
};

type Detail = {
  id: string;
  importNo: string;
  importDate: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REVERSED";
  supplierName: string | null;
  referenceNo: string | null;
  containerNo: string | null;
  notes: string | null;
  totalKg: number;
  totalBags: number;
  totalAmountPaidUsd: number;
  totalUsdConvertedLkr: number;
  totalUndiyalPaidLkr: number;
  totalDutyTaxLkr: number;
  totalBankProcessingChargesLkr: number;
  totalClearingChargesLkr: number;
  totalMiscellaneousLkr: number;
  totalShipmentCostLkr: number;
  totalExpectedRevenueLkr: number;
  totalExpectedProfitLkr: number;
  expectedProfitMarginPercentage: number;
  items: ImportItem[];
  stockBatches: Array<{
    id: string;
    batchNo: string;
    initialKg: number;
    remainingKg: number;
    remainingBags: number;
    costPerKgLkr: number;
    status: string;
  }>;
  stockMovements: Array<{
    id: string;
    movementType: string;
    quantityKg: number;
    reason: string | null;
    createdAt: string;
  }>;
};

export default function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/imports/${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setData(result.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load import.");
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(kind: "confirm" | "cancel" | "reverse") {
    const reason = kind === "reverse" ? window.prompt("Reverse reason") : undefined;
    if (kind === "reverse" && !reason?.trim()) return;
    const promptText =
      kind === "confirm"
        ? "Confirming this import will add stock to inventory. This action cannot be freely edited later."
        : kind === "cancel"
          ? "Cancel this draft import?"
          : "Reverse this import and remove unused stock?";
    if (!window.confirm(promptText)) return;
    const response = await fetch(
      `/api/imports/${id}${kind === "cancel" ? "" : `/${kind}`}`,
      {
        method: kind === "cancel" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "reverse" ? JSON.stringify({ reason }) : undefined,
      }
    );
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  if (!data) {
    return <main className="p-6 text-neutral-600">{message || "Loading import…"}</main>;
  }

  const shipmentCosts = [
    ["Amount Paid USD", formatCurrencyUsd(Number(data.totalAmountPaidUsd))],
    ["Amount Paid LKR", formatCurrencyLkr(Number(data.totalUsdConvertedLkr))],
    ["Undiyal", formatCurrencyLkr(Number(data.totalUndiyalPaidLkr))],
    ["Duty / Tax", formatCurrencyLkr(Number(data.totalDutyTaxLkr))],
    ["Bank Processing Charges", formatCurrencyLkr(Number(data.totalBankProcessingChargesLkr))],
    ["Clearing Charges", formatCurrencyLkr(Number(data.totalClearingChargesLkr))],
    ["Miscellaneous", formatCurrencyLkr(Number(data.totalMiscellaneousLkr))],
    ["Final Shipment Cost", formatCurrencyLkr(Number(data.totalShipmentCostLkr))],
  ];

  return (
    <main className="space-y-6 p-4 text-neutral-900 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-neutral-500">Import shipment</p>
          <h1 className="text-3xl font-semibold">{data.importNo}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {formatDate(data.importDate)} · {data.supplierName || "No supplier"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/import" className="rounded-xl border px-4 py-2 text-sm font-semibold">Back</Link>
          {data.status === "DRAFT" && (
            <>
              <Link href={`/import/${id}/edit`} className="rounded-xl border px-4 py-2 text-sm font-semibold">Edit Draft</Link>
              <button onClick={() => void action("confirm")} className="rounded-xl bg-[#FFBF01] px-4 py-2 text-sm font-bold">Confirm Import</button>
              <button onClick={() => void action("cancel")} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Cancel Draft</button>
            </>
          )}
          {data.status === "CONFIRMED" && (
            <button onClick={() => void action("reverse")} className="rounded-xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800">Reverse Import</button>
          )}
        </div>
      </div>

      {message && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</div>}

      <section className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-4">
        <Info label="Status" value={data.status} />
        <Info label="Reference" value={data.referenceNo || "—"} />
        <Info label="Container" value={data.containerNo || "—"} />
        <Info label="Notes" value={data.notes || "—"} />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Shipment Cost Totals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shipmentCosts.map(([label, value]) => (
            <SummaryValue key={label} label={label} value={value} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryValue label="Total KG" value={formatNumber(Number(data.totalKg))} />
          <SummaryValue label="Total Bags" value={formatNumber(Number(data.totalBags))} />
          <SummaryValue label="Expected Revenue" value={formatCurrencyLkr(Number(data.totalExpectedRevenueLkr))} />
          <SummaryValue label="Expected Profit" value={formatCurrencyLkr(Number(data.totalExpectedProfitLkr))} />
          <SummaryValue label="Margin" value={formatPercentage(Number(data.expectedProfitMarginPercentage))} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Import Items</h2>
        {data.items.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="font-semibold">{item.product.productName}</h3>
                <p className="text-xs text-neutral-500">{item.product.sku || "No SKU"}</p>
              </div>
              <div className="text-right text-sm">
                <p>{formatNumber(Number(item.quantityKg))} KG · {formatNumber(Number(item.quantityBags))} bags</p>
                <p className="text-xs text-neutral-500">{item.stockBatch?.batchNo || "Pending confirmation"}</p>
              </div>
            </div>

            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Cost Breakdown</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryValue label="Price per KG USD" value={formatCurrencyUsd(Number(item.usdAmountPerKg))} note="Reference only" />
              <SummaryValue label="Amount Paid USD" value={formatCurrencyUsd(Number(item.amountPaidUsd))} />
              <SummaryValue label="Exchange Rate" value={`${formatCurrencyLkr(Number(item.exchangeRateLkrUsd))} / USD`} />
              <SummaryValue label="Amount Paid LKR" value={formatCurrencyLkr(Number(item.usdConvertedLkr))} />
              <SummaryValue label="Undiyal" value={formatCurrencyLkr(Number(item.undiyalPaidLkr))} />
              <SummaryValue label="Duty / Tax" value={formatCurrencyLkr(Number(item.dutyTaxLkr))} />
              <SummaryValue label="Bank Processing Charges" value={formatCurrencyLkr(Number(item.bankProcessingChargesLkr))} />
              <SummaryValue label="Clearing Charges" value={formatCurrencyLkr(Number(item.clearingChargesLkr))} />
              <SummaryValue label="Miscellaneous" value={formatCurrencyLkr(Number(item.miscellaneousLkr))} />
              <SummaryValue label="Final Cost" value={formatCurrencyLkr(Number(item.finalItemCostLkr))} />
              <SummaryValue label="Cost / KG" value={formatCurrencyLkr(Number(item.costPerKgLkr))} />
              <SummaryValue label="Cost / Bag" value={formatCurrencyLkr(Number(item.costPerBagLkr))} />
            </div>

            <h4 className="mb-3 mt-5 border-t pt-4 text-xs font-bold uppercase tracking-wide text-neutral-500">Profit</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryValue label="Selling Price / KG" value={formatCurrencyLkr(Number(item.sellingPricePerKgLkr))} />
              <SummaryValue label="Expected Revenue" value={formatCurrencyLkr(Number(item.expectedRevenueLkr))} />
              <SummaryValue label="Expected Profit" value={formatCurrencyLkr(Number(item.expectedProfitLkr))} />
              <SummaryValue label="Margin" value={formatPercentage(Number(item.expectedProfitMarginPercentage))} />
            </div>
          </article>
        ))}
      </section>

      <DataTable title="Stock batches" heads={["Batch", "Initial KG", "Remaining KG", "Remaining bags", "Cost / KG", "Stock value", "Status"]}>
        {data.stockBatches.length ? data.stockBatches.map((batch) => (
          <tr key={batch.id} className="border-t">
            <td className="p-4 font-semibold">{batch.batchNo}</td>
            <td className="p-4">{formatNumber(Number(batch.initialKg))}</td>
            <td className="p-4">{formatNumber(Number(batch.remainingKg))}</td>
            <td className="p-4">{formatNumber(Number(batch.remainingBags))}</td>
            <td className="p-4">{formatCurrencyLkr(Number(batch.costPerKgLkr))}</td>
            <td className="p-4">{formatCurrencyLkr(Number(batch.remainingKg) * Number(batch.costPerKgLkr))}</td>
            <td className="p-4">{batch.status}</td>
          </tr>
        )) : <tr><td colSpan={7} className="p-6 text-center text-neutral-500">No batches created yet.</td></tr>}
      </DataTable>

      <DataTable title="Movement history" heads={["Type", "Quantity KG", "Reason", "Date"]}>
        {data.stockMovements.length ? data.stockMovements.map((movement) => (
          <tr key={movement.id} className="border-t">
            <td className="p-4 font-semibold">{movement.movementType}</td>
            <td className="p-4">{formatNumber(Number(movement.quantityKg))}</td>
            <td className="p-4">{movement.reason || "—"}</td>
            <td className="p-4">{formatDate(movement.createdAt)}</td>
          </tr>
        )) : <tr><td colSpan={4} className="p-6 text-center text-neutral-500">No inventory movements yet.</td></tr>}
      </DataTable>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase text-neutral-500">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}

function SummaryValue({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-500">{label}</p><p className="mt-1 font-semibold">{value}</p>{note && <p className="mt-1 text-xs text-amber-700">{note}</p>}</div>;
}

function DataTable({ title, heads, children }: { title: string; heads: string[]; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><h2 className="border-b p-5 text-lg font-semibold">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-neutral-50"><tr>{heads.map((head) => <th key={head} className="p-4 font-semibold">{head}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>;
}
