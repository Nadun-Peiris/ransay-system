"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { SkeletonBlock, SkeletonCardGrid, SkeletonTable } from "@/components/skeleton";

type StockMovement = {
  id: string;
  movementType:
    | "ORDER_SALE"
    | "ORDER_COMMIT"
    | "ORDER_UNCOMMIT"
    | "ORDER_DELIVERY_DEDUCTION"
    | "ORDER_DELETE_REVERSAL"
    | "STOCK_IN"
    | "STOCK_OUT"
    | "STOCK_ADJUSTMENT";
  quantityBags: number;
  quantityKg: number;
  reason: string | null;
  createdAt: string;
  order: { id: string; orderId: string } | null;
  createdByUser: { id: string; name: string; role: string };
};

type ProductDetail = {
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockMovements: StockMovement[];
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

function movementBadgeClass(type: StockMovement["movementType"]) {
  if (type === "STOCK_IN" || type === "ORDER_DELETE_REVERSAL") {
    return "bg-green-100 text-green-700";
  }

  if (type === "STOCK_OUT" || type === "ORDER_SALE") {
    return "bg-red-100 text-red-700";
  }

  return "bg-blue-100 text-blue-700";
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [form, setForm] = useState({
    productName: "",
    sku: "",
    kgPerBag: "",
    defaultSellingPricePerKg: "",
    isActive: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProduct = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/products/${params.id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load product.");
      }

      const nextProduct = result.data as ProductDetail;
      setProduct(nextProduct);
      setForm({
        productName: nextProduct.productName,
        sku: nextProduct.sku ?? "",
        kgPerBag: String(nextProduct.kgPerBag),
        defaultSellingPricePerKg: String(nextProduct.defaultSellingPricePerKg),
        isActive: nextProduct.isActive,
      });
    } catch (error) {
      console.error("Failed to load product:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load product."
      );
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      setIsSaving(true);
      const response = await fetch(`/api/products/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: form.productName,
          sku: form.sku || null,
          kgPerBag: Number(form.kgPerBag),
          defaultSellingPricePerKg: Number(form.defaultSellingPricePerKg || 0),
          isActive: form.isActive,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update product.");
      }

      setMessage("Product updated successfully.");
      await loadProduct();
    } catch (error) {
      console.error("Failed to update product:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to update product."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="p-6">
        <div className="mb-8">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="mt-3 h-4 w-72" />
        </div>
        <SkeletonCardGrid count={4} />
        <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <SkeletonTable columns={5} rows={6} />
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Product not found.</p>
          <BackButton href="/products/search" label="Back to products" className="mt-4" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 text-black">
      <div className="mb-6">
        <BackButton href="/products/search" label="Back to products" className="mb-3" />
        <h1 className="text-3xl font-semibold text-neutral-900">
          {product.productName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Product details, stock, and movement history.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#FFBF01]/30 bg-[#FFBF01]/10 px-4 py-3 text-sm font-medium text-yellow-900">
          {message}
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">On Hand Bags</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatNumber(product.onHandBags)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Available Bags</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatNumber(product.availableBags)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Committed Bags</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatNumber(product.committedBags)}
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Edit Product</h2>
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <TextInput
            label="Product name"
            value={form.productName}
            onChange={(value) => setForm((current) => ({ ...current, productName: value }))}
            required
          />
          <TextInput
            label="SKU"
            value={form.sku}
            onChange={(value) => setForm((current) => ({ ...current, sku: value }))}
          />
          <TextInput
            label="Kg per bag"
            type="number"
            value={form.kgPerBag}
            onChange={(value) => setForm((current) => ({ ...current, kgPerBag: value }))}
            required
          />
          <TextInput
            label="Default price / kg"
            type="number"
            value={form.defaultSellingPricePerKg}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                defaultSellingPricePerKg: value,
              }))
            }
          />
          <label className="flex items-end gap-3 pb-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold text-neutral-700">
              Active
            </span>
          </label>
          <div className="flex items-end xl:col-span-5">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#e5ab00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b bg-neutral-50 px-5 py-4">
          <h2 className="text-lg font-semibold">Stock Movement History</h2>
        </div>
        {product.stockMovements.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            No stock movements found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="p-4">Type</th>
                  <th className="p-4">Bags</th>
                  <th className="p-4">Kg</th>
                  <th className="p-4">Order</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Created By</th>
                  <th className="p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {product.stockMovements.map((movement) => (
                  <tr key={movement.id} className="border-b last:border-b-0">
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${movementBadgeClass(
                          movement.movementType
                        )}`}
                      >
                        {movement.movementType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-4">{formatNumber(movement.quantityBags)}</td>
                    <td className="p-4">{formatNumber(movement.quantityKg)}</td>
                    <td className="p-4">
                      {movement.order ? (
                        <Link
                          href={`/orders/${movement.order.id}`}
                          className="font-semibold underline decoration-transparent underline-offset-4 hover:text-[#C8942A] hover:decoration-[#C8942A]"
                        >
                          {movement.order.orderId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4 text-neutral-600">
                      {movement.reason || "-"}
                    </td>
                    <td className="p-4">
                      {movement.createdByUser.name} ({movement.createdByUser.role})
                    </td>
                    <td className="p-4 text-neutral-500">
                      {new Date(movement.createdAt).toLocaleDateString("en-LK")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
      />
    </label>
  );
}
