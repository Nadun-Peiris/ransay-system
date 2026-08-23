"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SkeletonTable } from "@/components/skeleton";

type ProductRow = {
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
};

type ProductsMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type ProductForm = {
  productName: string;
  sku: string;
  kgPerBag: string;
  defaultSellingPricePerKg: string;
  openingStockBags: string;
};

const emptyForm: ProductForm = {
  productName: "",
  sku: "",
  kgPerBag: "",
  defaultSellingPricePerKg: "",
  openingStockBags: "",
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

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [meta, setMeta] = useState<ProductsMeta | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function fetchProducts() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (debouncedQ.trim()) {
        params.set("q", debouncedQ.trim());
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load products.");
      }

      setProducts(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error("Failed to load products:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load products."
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
    void fetchProducts();
  }, [debouncedQ, page]);

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      setIsSaving(true);

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: form.productName,
          sku: form.sku || null,
          kgPerBag: Number(form.kgPerBag),
          defaultSellingPricePerKg: Number(form.defaultSellingPricePerKg || 0),
          openingStockBags: Number(form.openingStockBags || 0),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create product.");
      }

      setForm(emptyForm);
      setMessage("Product created successfully.");
      await fetchProducts();
    } catch (error) {
      console.error("Failed to create product:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to create product."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate(product: ProductRow) {
    const confirmed = window.confirm(
      `Deactivate ${product.productName}? It will no longer appear in active product lists.`
    );

    if (!confirmed) return;

    try {
      setMessage(null);
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to deactivate product.");
      }

      setMessage("Product deactivated successfully.");
      await fetchProducts();
    } catch (error) {
      console.error("Failed to deactivate product:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to deactivate product."
      );
    }
  }

  return (
    <main className="p-6 text-black">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-neutral-900">Products</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage products, default pricing, and opening stock.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#FFBF01]/30 bg-[#FFBF01]/10 px-4 py-3 text-sm font-medium text-yellow-900">
          {message}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          Create Product
        </h2>
        <form
          onSubmit={handleCreateProduct}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        >
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
          <TextInput
            label="Opening stock bags"
            type="number"
            value={form.openingStockBags}
            onChange={(value) =>
              setForm((current) => ({ ...current, openingStockBags: value }))
            }
          />

          <div className="flex items-end xl:col-span-5">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#e5ab00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Creating..." : "Create product"}
            </button>
          </div>
        </form>
      </section>

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
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Kg / Bag</th>
                  <th className="p-4">On Hand Bags</th>
                  <th className="p-4">Available Bags</th>
                  <th className="p-4">Committed Bags</th>
                  <th className="p-4">Default Price / Kg</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b last:border-b-0">
                    <td className="p-4 font-semibold">{product.productName}</td>
                    <td className="p-4 text-neutral-600">
                      {product.sku || "-"}
                    </td>
                    <td className="p-4">{formatNumber(product.kgPerBag)}</td>
                    <td className="p-4">{formatNumber(product.onHandBags)}</td>
                    <td className="p-4">{formatNumber(product.availableBags)}</td>
                    <td className="p-4">{formatNumber(product.committedBags)}</td>
                    <td className="p-4">
                      {formatMoney(product.defaultSellingPricePerKg)}
                    </td>
                    <td className="p-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        ACTIVE
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/products/${product.id}`}
                          className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                          View/Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(product)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
