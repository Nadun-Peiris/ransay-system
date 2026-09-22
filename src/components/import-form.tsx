"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calculateImportItem,
  calculateImportShipmentTotals,
} from "@/lib/imports/import-calculations";
import {
  formatCurrencyLkr,
  formatCurrencyUsd,
  formatNumber,
  formatPercentage,
} from "@/lib/formatters";

type Product = {
  id: string;
  productName: string;
  sku: string | null;
  kgPerBag: number;
  defaultSellingPricePerKg: number;
};

type Item = {
  productId: string;
  quantityKg: string;
  kgPerBag: string;
  usdAmountPerKg: string;
  amountPaidUsd: string;
  exchangeRateLkrUsd: string;
  undiyalPaidLkr: string;
  dutyTaxLkr: string;
  bankProcessingChargesLkr: string;
  clearingChargesLkr: string;
  miscellaneousLkr: string;
  sellingPricePerKgLkr: string;
};

const emptyItem = (): Item => ({
  productId: "",
  quantityKg: "",
  kgPerBag: "",
  usdAmountPerKg: "0",
  amountPaidUsd: "0",
  exchangeRateLkrUsd: "0",
  undiyalPaidLkr: "0",
  dutyTaxLkr: "0",
  bankProcessingChargesLkr: "0",
  clearingChargesLkr: "0",
  miscellaneousLkr: "0",
  sellingPricePerKgLkr: "0",
});

const inputClass =
  "w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500";
const readOnlyClass = `${inputClass} bg-neutral-100 text-neutral-700`;

function numberValue(value: string) {
  return Number(value || 0);
}

export function ImportForm({ importId }: { importId?: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [header, setHeader] = useState({
    importDate: new Date().toISOString().slice(0, 10),
    supplierName: "",
    referenceNo: "",
    containerNo: "",
    notes: "",
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [loading, setLoading] = useState(Boolean(importId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const productResponse = await fetch("/api/products?limit=100");
        const productResult = await productResponse.json();
        if (!productResponse.ok) {
          throw new Error(productResult.message || "Failed to load products.");
        }
        setProducts(productResult.data);

        if (importId) {
          const response = await fetch(`/api/imports/${importId}`);
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          const data = result.data;
          if (data.status !== "DRAFT") {
            throw new Error("Only draft imports can be edited.");
          }
          setHeader({
            importDate: String(data.importDate).slice(0, 10),
            supplierName: data.supplierName ?? "",
            referenceNo: data.referenceNo ?? "",
            containerNo: data.containerNo ?? "",
            notes: data.notes ?? "",
          });
          setItems(
            data.items.map((item: Record<string, unknown>) => ({
              productId: String(item.productId),
              quantityKg: String(item.quantityKg),
              kgPerBag: String(item.kgPerBag),
              usdAmountPerKg: String(item.usdAmountPerKg),
              amountPaidUsd: String(item.amountPaidUsd),
              exchangeRateLkrUsd: String(item.exchangeRateLkrUsd),
              undiyalPaidLkr: String(item.undiyalPaidLkr),
              dutyTaxLkr: String(item.dutyTaxLkr),
              bankProcessingChargesLkr: String(
                item.bankProcessingChargesLkr ?? 0
              ),
              clearingChargesLkr: String(item.clearingChargesLkr),
              miscellaneousLkr: String(item.miscellaneousLkr),
              sellingPricePerKgLkr: String(item.sellingPricePerKgLkr),
            }))
          );
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load form.");
      } finally {
        setLoading(false);
      }
    })();
  }, [importId]);

  const calculated = useMemo(
    () =>
      items.map((item) => {
        try {
          return calculateImportItem({
            quantityKg: numberValue(item.quantityKg),
            kgPerBag: numberValue(item.kgPerBag),
            usdAmountPerKg: numberValue(item.usdAmountPerKg),
            amountPaidUsd: numberValue(item.amountPaidUsd),
            exchangeRateLkrUsd: numberValue(item.exchangeRateLkrUsd),
            undiyalPaidLkr: numberValue(item.undiyalPaidLkr),
            dutyTaxLkr: numberValue(item.dutyTaxLkr),
            bankProcessingChargesLkr: numberValue(
              item.bankProcessingChargesLkr
            ),
            clearingChargesLkr: numberValue(item.clearingChargesLkr),
            miscellaneousLkr: numberValue(item.miscellaneousLkr),
            sellingPricePerKgLkr: numberValue(item.sellingPricePerKgLkr),
          });
        } catch {
          return null;
        }
      }),
    [items]
  );
  const totals = calculateImportShipmentTotals(
    calculated.filter((value) => value !== null)
  );

  function update(index: number, key: keyof Item, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId,
              kgPerBag: product ? String(product.kgPerBag) : item.kgPerBag,
              sellingPricePerKgLkr: product
                ? String(product.defaultSellingPricePerKg)
                : item.sellingPricePerKgLkr,
            }
          : item
      )
    );
  }

  async function save(view: boolean) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(importId ? `/api/imports/${importId}` : "/api/imports", {
        method: importId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...header,
          items: items.map((item) => ({
            productId: item.productId,
            quantityKg: numberValue(item.quantityKg),
            kgPerBag: numberValue(item.kgPerBag),
            usdAmountPerKg: numberValue(item.usdAmountPerKg),
            amountPaidUsd: numberValue(item.amountPaidUsd),
            exchangeRateLkrUsd: numberValue(item.exchangeRateLkrUsd),
            undiyalPaidLkr: numberValue(item.undiyalPaidLkr),
            dutyTaxLkr: numberValue(item.dutyTaxLkr),
            bankProcessingChargesLkr: numberValue(
              item.bankProcessingChargesLkr
            ),
            clearingChargesLkr: numberValue(item.clearingChargesLkr),
            miscellaneousLkr: numberValue(item.miscellaneousLkr),
            sellingPricePerKgLkr: numberValue(item.sellingPricePerKgLkr),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save import.");
      }
      router.push(view || importId ? `/import/${result.data.id}` : "/import");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save import.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-neutral-500">Loading import…</div>;

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void save(true);
      }}
      className="space-y-6"
    >
      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {message}
        </div>
      )}

      <section className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <Field label="Import date">
          <input required type="date" value={header.importDate} onChange={(event) => setHeader({ ...header, importDate: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Supplier name">
          <input value={header.supplierName} onChange={(event) => setHeader({ ...header, supplierName: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Reference no">
          <input value={header.referenceNo} onChange={(event) => setHeader({ ...header, referenceNo: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Container no">
          <input value={header.containerNo} onChange={(event) => setHeader({ ...header, containerNo: event.target.value })} className={inputClass} />
        </Field>
        <label className="md:col-span-2 xl:col-span-4">
          <span className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Notes</span>
          <textarea value={header.notes} onChange={(event) => setHeader({ ...header, notes: event.target.value })} className={inputClass} />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Import items</h2>
          <button type="button" onClick={() => setItems([...items, emptyItem()])} className="rounded-xl border px-4 py-2 text-sm font-semibold">Add product</button>
        </div>

        {items.map((item, index) => {
          const calc = calculated[index];
          return (
            <div key={index} className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex justify-between">
                <h3 className="font-semibold">Item {index + 1}</h3>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} className="text-sm font-semibold text-red-700">Remove</button>
                )}
              </div>

              <ItemSection title="Product / Quantity">
                <Field label="Product">
                  <select required value={item.productId} onChange={(event) => selectProduct(index, event.target.value)} className={inputClass}>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.productName}{product.sku ? ` · ${product.sku}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <NumberField label="Quantity KG" value={item.quantityKg} onChange={(value) => update(index, "quantityKg", value)} />
                <NumberField label="KG per Bag" value={item.kgPerBag} onChange={(value) => update(index, "kgPerBag", value)} />
                <ReadOnlyField label="Quantity Bags" value={formatNumber(calc?.quantityBags ?? 0)} />
              </ItemSection>

              <ItemSection title="Foreign Currency">
                <NumberField label="Price per KG (USD)" help="For reference only. This value is not used in costing calculations." value={item.usdAmountPerKg} onChange={(value) => update(index, "usdAmountPerKg", value)} />
                <NumberField label="Amount Paid (USD)" value={item.amountPaidUsd} onChange={(value) => update(index, "amountPaidUsd", value)} />
                <NumberField label="Exchange Rate LKR/USD" value={item.exchangeRateLkrUsd} onChange={(value) => update(index, "exchangeRateLkrUsd", value)} />
                <ReadOnlyField label="Amount Paid (LKR)" value={formatCurrencyLkr(calc?.usdConvertedLkr ?? 0)} />
              </ItemSection>

              <ItemSection title="Local / Additional Costs">
                <NumberField label="Amount Paid in Undiyal (LKR)" value={item.undiyalPaidLkr} onChange={(value) => update(index, "undiyalPaidLkr", value)} />
                <NumberField label="Duty / Tax (LKR)" value={item.dutyTaxLkr} onChange={(value) => update(index, "dutyTaxLkr", value)} />
                <NumberField label="Bank Processing Charges (LKR)" value={item.bankProcessingChargesLkr} onChange={(value) => update(index, "bankProcessingChargesLkr", value)} />
                <NumberField label="Clearing Charges (LKR)" value={item.clearingChargesLkr} onChange={(value) => update(index, "clearingChargesLkr", value)} />
                <NumberField label="Miscellaneous (LKR)" value={item.miscellaneousLkr} onChange={(value) => update(index, "miscellaneousLkr", value)} />
              </ItemSection>

              <ItemSection title="Cost Summary">
                <ReadOnlyField label="Final Item Cost (LKR)" value={formatCurrencyLkr(calc?.finalItemCostLkr ?? 0)} />
                <ReadOnlyField label="Cost per KG" value={formatCurrencyLkr(calc?.costPerKgLkr ?? 0)} />
                <ReadOnlyField label="Cost per Bag" value={formatCurrencyLkr(calc?.costPerBagLkr ?? 0)} />
              </ItemSection>

              <ItemSection title="Profit">
                <NumberField label="Selling Price per KG" value={item.sellingPricePerKgLkr} onChange={(value) => update(index, "sellingPricePerKgLkr", value)} />
                <ReadOnlyField label="Expected Revenue" value={formatCurrencyLkr(calc?.expectedRevenueLkr ?? 0)} />
                <ReadOnlyField label="Expected Profit" value={formatCurrencyLkr(calc?.expectedProfitLkr ?? 0)} />
                <ReadOnlyField label="Expected Profit Margin %" value={formatPercentage(calc?.expectedProfitMarginPercentage ?? 0)} />
              </ItemSection>
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 rounded-2xl border bg-neutral-900 p-5 text-white sm:grid-cols-2 xl:grid-cols-7">
        {[
          ["Total KG", formatNumber(totals.totalKg)],
          ["Total bags", formatNumber(totals.totalBags)],
          ["Amount paid USD", formatCurrencyUsd(totals.totalAmountPaidUsd)],
          ["Amount paid LKR", formatCurrencyLkr(totals.totalUsdConvertedLkr)],
          ["Shipment cost", formatCurrencyLkr(totals.totalShipmentCostLkr)],
          ["Expected profit", formatCurrencyLkr(totals.totalExpectedProfitLkr)],
          ["Margin", formatPercentage(totals.expectedProfitMarginPercentage)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-neutral-400">{label}</p>
            <p className="mt-1 font-bold">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-xl border px-5 py-2.5 font-semibold disabled:opacity-50">Save Draft</button>
        <button disabled={saving} className="rounded-xl bg-[#FFBF01] px-5 py-2.5 font-bold text-black disabled:opacity-50">{saving ? "Saving…" : "Save Draft and View"}</button>
      </div>
    </form>
  );
}

function ItemSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold uppercase text-neutral-500">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-neutral-500">{help}</span>}
    </label>
  );
}

function NumberField({ label, value, help, onChange }: { label: string; value: string; help?: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} help={help}>
      <input required step="any" min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </Field>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <input readOnly value={value} className={readOnlyClass} />
    </Field>
  );
}
