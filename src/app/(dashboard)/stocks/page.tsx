"use client";

import { FormEvent, useEffect, useState } from "react";
import { SkeletonTable } from "@/components/skeleton";

type StockProduct = {
  id: string;
  productName: string;
  sku: string | null;
  kgPerBag: number;
  stockBags: number;
  stockKg: number;
  onHandBags: number;
  onHandKg: number;
  committedBags: number;
  committedKg: number;
  unavailableBags: number;
  unavailableKg: number;
  availableBags: number;
  availableKg: number;
  defaultSellingPricePerKg: number;
};

type StocksMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type EditableColumn = "available" | "onHand";
type EditMethod = "SET_TO" | "ADJUST_BY";

type InventoryEditState = {
  product: StockProduct;
  column: EditableColumn;
  method: EditMethod;
  value: string;
  reason: string;
};

function formatNumber(value: number) {
  return value.toLocaleString("en-LK", {
    maximumFractionDigits: 2,
  });
}

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getModalTitle(column: EditableColumn) {
  return column === "available" ? "Edit available" : "Edit on hand";
}

export default function StocksPage() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [meta, setMeta] = useState<StocksMeta | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editState, setEditState] = useState<InventoryEditState | null>(null);

  async function fetchStocks() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (debouncedQ.trim()) {
        params.set("q", debouncedQ.trim());
      }

      const response = await fetch(`/api/stocks?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load stocks.");
      }

      setProducts(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error("Failed to load stocks:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load stocks."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [q]);

  useEffect(() => {
    void fetchStocks();
  }, [debouncedQ, page]);

  function openInventoryEditor(product: StockProduct, column: EditableColumn) {
    setMessage(null);
    setEditState({
      product,
      column,
      method: "SET_TO",
      value: String(column === "available" ? product.availableBags : product.onHandBags),
      reason: "",
    });
  }

  function closeInventoryEditor(force = false) {
    if (isSaving && !force) return;
    setEditState(null);
  }

  async function handleSaveInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editState) return;

    setMessage(null);

    try {
      setIsSaving(true);

      const numericValue = Number(editState.value);

      if (!Number.isFinite(numericValue)) {
        throw new Error("Enter a valid stock quantity.");
      }

      if (editState.method === "SET_TO" && numericValue < 0) {
        throw new Error("Stock quantity cannot be negative.");
      }

      if (editState.method === "ADJUST_BY" && numericValue === 0) {
        throw new Error("Adjustment quantity cannot be zero.");
      }

      const payload =
        editState.method === "SET_TO"
          ? {
              productId: editState.product.id,
              movementType: "STOCK_ADJUSTMENT",
              newStockBags:
                editState.column === "available"
                  ? numericValue +
                    editState.product.committedBags +
                    editState.product.unavailableBags
                  : numericValue,
              reason:
                editState.reason.trim() ||
                `Set ${editState.column === "available" ? "available" : "on hand"} stock`,
            }
          : {
              productId: editState.product.id,
              movementType: numericValue > 0 ? "STOCK_IN" : "STOCK_OUT",
              quantityBags: Math.abs(numericValue),
              reason:
                editState.reason.trim() ||
                `Adjusted ${editState.column === "available" ? "available" : "on hand"} stock`,
            };

      const response = await fetch("/api/stocks/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update inventory.");
      }

      setMessage("Inventory updated successfully.");
      closeInventoryEditor(true);
      await fetchStocks();
    } catch (error) {
      console.error("Failed to update inventory:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to update inventory."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="p-6 text-black">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-neutral-900">Stocks</h1>
        <p className="mt-1 text-sm text-neutral-500">
          View inventory states and edit available or on hand quantities.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#FFBF01]/30 bg-[#FFBF01]/10 px-4 py-3 text-sm font-medium text-yellow-900">
          {message}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <label className="block max-w-xl space-y-1.5">
          <span className="text-xs font-semibold uppercase text-neutral-500">
            Search
          </span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Product name or SKU"
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
          />
        </label>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-neutral-50 px-5 py-4">
          <p className="text-sm font-medium text-neutral-700">
            {meta?.totalCount ?? 0} total product
            {(meta?.totalCount ?? 0) === 1 ? "" : "s"}
          </p>
        </div>

        {isLoading && products.length === 0 ? (
          <SkeletonTable columns={6} rows={8} />
        ) : products.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="w-12 p-4">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </th>
                  <th className="p-4 text-base font-semibold">Product</th>
                  <th className="p-4 text-base font-semibold">SKU</th>
                  <InventoryHeader label="Committed" />
                  <InventoryHeader label="Available" />
                  <InventoryHeader label="On hand" />
                  <th className="p-4 text-base font-semibold">
                    Default Price / Kg
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const committed = product.committedBags;
                  const available = product.availableBags;
                  const onHand = product.onHandBags;

                  return (
                    <tr
                      key={product.id}
                      className="border-b last:border-b-0 hover:bg-neutral-50/70"
                    >
                      <td className="p-4 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.productName}`}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-400">
                            <svg
                              className="h-7 w-7"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.8}
                                d="m3 16 4-4a2 2 0 0 1 2.8 0l1.2 1.2 3.2-3.2a2 2 0 0 1 2.8 0l4 4M5 5h14v14H5z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-base font-semibold text-neutral-900">
                              {product.productName}
                            </p>
                            <span className="mt-2 inline-flex rounded-lg bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                              {formatNumber(product.kgPerBag)} kg / bag
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-base text-neutral-600">
                        {product.sku || "-"}
                      </td>
                      <td className="p-4 text-right text-base font-medium text-neutral-800">
                        {formatNumber(committed)}
                      </td>
                      <td className="p-4 text-right">
                        <EditableQuantityButton
                          value={available}
                          label={`Edit available stock for ${product.productName}`}
                          onClick={() => openInventoryEditor(product, "available")}
                        />
                      </td>
                      <td className="p-4 text-right">
                        <EditableQuantityButton
                          value={onHand}
                          label={`Edit on hand stock for ${product.productName}`}
                          onClick={() => openInventoryEditor(product, "onHand")}
                        />
                      </td>
                      <td className="p-4 text-right text-base text-neutral-600">
                        {formatMoney(product.defaultSellingPricePerKg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              disabled={meta.page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-center text-sm text-neutral-500">
              Page {meta.page} of {Math.max(meta.totalPages, 1)}
            </p>
            <button
              type="button"
              disabled={meta.page >= meta.totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {editState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="border-b border-neutral-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">
                    {getModalTitle(editState.column)}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {editState.product.productName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => closeInventoryEditor()}
                  disabled={isSaving}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveInventory} className="space-y-5 px-6 py-5">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-neutral-500">Current on hand</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(editState.product.onHandBags)} bags
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-neutral-500">Current available</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(editState.product.availableBags)} bags
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-neutral-500">Committed</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(editState.product.committedBags)} bags
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-neutral-500">Current stock kg</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(editState.product.onHandKg)} kg
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 rounded-xl border border-neutral-200 bg-neutral-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    setEditState((current) =>
                      current
                        ? {
                            ...current,
                            method: "SET_TO",
                            value: String(
                              current.column === "available"
                                ? current.product.availableBags
                                : current.product.onHandBags
                            ),
                          }
                        : current
                    )
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    editState.method === "SET_TO"
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-950"
                  }`}
                >
                  Set to
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditState((current) =>
                      current
                        ? {
                            ...current,
                            method: "ADJUST_BY",
                            value: "",
                          }
                        : current
                    )
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    editState.method === "ADJUST_BY"
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-950"
                  }`}
                >
                  Adjust by
                </button>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-neutral-500">
                  {editState.method === "SET_TO"
                    ? "New quantity"
                    : "Adjustment"}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={editState.method === "SET_TO" ? "0" : undefined}
                  required
                  value={editState.value}
                  onChange={(event) =>
                    setEditState((current) =>
                      current
                        ? {
                            ...current,
                            value: event.target.value,
                          }
                        : current
                    )
                  }
                  placeholder={
                    editState.method === "SET_TO" ? "Set stock to" : "Use negative to reduce"
                  }
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
                />
                {editState.method === "ADJUST_BY" && (
                  <p className="text-xs text-neutral-500">
                    Enter a positive number to add stock or a negative number to
                    reduce stock.
                  </p>
                )}
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-neutral-500">
                  Reason
                </span>
                <input
                  value={editState.reason}
                  onChange={(event) =>
                    setEditState((current) =>
                      current
                        ? {
                            ...current,
                            reason: event.target.value,
                          }
                        : current
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => closeInventoryEditor()}
                  disabled={isSaving}
                  className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#e5ab00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function InventoryHeader({ label }: { label: string }) {
  return (
    <th className="p-4 text-right text-base font-semibold">
      <span className="border-b border-dotted border-neutral-400 text-neutral-600">
        {label}
      </span>
    </th>
  );
}

function EditableQuantityButton({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="min-w-20 rounded-lg px-3 py-2 text-right text-base font-semibold text-neutral-900 transition hover:bg-[#FFBF01]/20 focus:outline-none focus:ring-4 focus:ring-[#FFBF01]/25"
    >
      {formatNumber(value)}
    </button>
  );
}
