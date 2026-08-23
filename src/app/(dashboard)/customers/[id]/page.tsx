"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { SkeletonBlock, SkeletonCardGrid, SkeletonTable } from "@/components/skeleton";

type CustomerType = "VAT" | "NON_VAT";

type RecentOrder = {
  id: string;
  orderId: string;
  vatOrderId: string | null;
  nonVatOrderId: string | null;
  orderType: CustomerType;
  totalAmount: number;
  paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  fulfillmentStatus: "UNFULFILLED" | "FULFILLED";
  deliveryStatus: "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
  orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
  createdAt: string;
};

type CustomerDetail = {
  id: string;
  customerCode: string | null;
  customerName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  position: string | null;
  addresses: {
    id: string;
    label: string | null;
    address: string;
    isDefault: boolean;
  }[];
  customerType: CustomerType;
  vatNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  totalSalesAmount: number;
  recentOrders: RecentOrder[];
};

type CustomerForm = {
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  addresses: {
    label: string;
    address: string;
    isDefault: boolean;
  }[];
  customerType: CustomerType;
  vatNumber: string;
  isActive: boolean;
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function badgeClass(type: "blue" | "gray" | "green" | "red" | "yellow") {
  const classes = {
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-neutral-100 text-neutral-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    yellow: "bg-[#FFBF01]/20 text-yellow-900",
  };

  return classes[type];
}

function paymentBadge(status: RecentOrder["paymentStatus"]) {
  if (status === "PAID") return "green";
  if (status === "DUE") return "yellow";
  if (status === "OVERDUE") return "red";
  return "gray";
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<CustomerForm>({
    customerName: "",
    contactPerson: "",
    phone: "",
    email: "",
    addresses: [{ label: "Primary", address: "", isDefault: true }],
    customerType: "NON_VAT",
    vatNumber: "",
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCustomer = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/customers/${params.id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load customer.");
      }

      const nextCustomer = result.data as CustomerDetail;
      setCustomer(nextCustomer);
      setForm({
        customerName: nextCustomer.customerName,
        contactPerson: nextCustomer.contactPerson ?? "",
        phone: nextCustomer.phone ?? "",
        email: nextCustomer.email ?? "",
        addresses:
          nextCustomer.addresses.length > 0
            ? nextCustomer.addresses.map((address) => ({
                label: address.label ?? "",
                address: address.address,
                isDefault: address.isDefault,
              }))
            : [
                {
                  label: "Primary",
                  address: nextCustomer.address ?? "",
                  isDefault: true,
                },
              ],
        customerType: nextCustomer.customerType,
        vatNumber: nextCustomer.vatNumber ?? "",
        isActive: nextCustomer.isActive,
      });
    } catch (error) {
      console.error("Failed to load customer:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load customer."
      );
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      setIsSaving(true);
      const response = await fetch(`/api/customers/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: form.customerName,
          contactPerson: form.contactPerson || null,
          phone: form.phone || null,
          email: form.email || null,
          addresses: form.addresses,
          customerType: form.customerType,
          vatNumber: form.customerType === "VAT" ? form.vatNumber : null,
          isActive: form.isActive,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update customer.");
      }

      setMessage("Customer updated successfully.");
      await loadCustomer();
    } catch (error) {
      console.error("Failed to update customer:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to update customer."
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
        <SkeletonCardGrid count={3} />
        <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <SkeletonTable columns={5} rows={5} />
        </section>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Customer not found.</p>
          <BackButton href="/customers/search" label="Back to customers" className="mt-4" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 text-black">
      <div className="mb-6">
        <BackButton href="/customers/search" label="Back to customers" className="mb-3" />
        <h1 className="text-3xl font-semibold text-neutral-900">
          {customer.customerName}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Customer details, recent orders, and sales totals.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#FFBF01]/30 bg-[#FFBF01]/10 px-4 py-3 text-sm font-medium text-yellow-900">
          {message}
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total orders" value={String(customer.orderCount)} />
        <StatCard label="Total sales" value={formatMoney(customer.totalSalesAmount)} />
        <StatCard
          label="Customer type"
          value={customer.customerType === "VAT" ? "VAT" : "NON-VAT"}
        />
        <StatCard label="Status" value={customer.isActive ? "Active" : "Inactive"} />
      </section>

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Edit Customer</h2>
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Company Name"
            value={form.customerName}
            onChange={(value) => setForm((current) => ({ ...current, customerName: value }))}
            required
          />
          <TextInput
            label="Contact Person"
            value={form.contactPerson}
            onChange={(value) => setForm((current) => ({ ...current, contactPerson: value }))}
          />
          <TextInput
            label="Phone"
            value={form.phone}
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <AddressFields
            addresses={form.addresses}
            onChange={(addresses) =>
              setForm((current) => ({ ...current, addresses }))
            }
          />
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Customer Type
            </span>
            <select
              value={form.customerType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customerType: event.target.value as CustomerType,
                  vatNumber:
                    event.target.value === "VAT" ? current.vatNumber : "",
                }))
              }
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            >
              <option value="NON_VAT">NON-VAT</option>
              <option value="VAT">VAT</option>
            </select>
          </label>
          {form.customerType === "VAT" && (
            <TextInput
              label="VAT No"
              value={form.vatNumber}
              onChange={(value) => setForm((current) => ({ ...current, vatNumber: value }))}
              required
            />
          )}
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
          <div className="flex items-end md:col-span-2">
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
          <h2 className="text-lg font-semibold">Recent Orders</h2>
        </div>
        {customer.recentOrders.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            No recent orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Fulfillment</th>
                  <th className="p-4">Delivery</th>
                  <th className="p-4">Order Status</th>
                  <th className="p-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {customer.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="p-4">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-semibold text-neutral-950 underline decoration-transparent underline-offset-4 hover:text-[#C8942A] hover:decoration-[#C8942A]"
                      >
                        {order.orderId}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {order.vatOrderId ?? order.nonVatOrderId}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge
                        label={order.orderType === "VAT" ? "VAT" : "NON-VAT"}
                        type={order.orderType === "VAT" ? "blue" : "gray"}
                      />
                    </td>
                    <td className="p-4 font-medium">{formatMoney(order.totalAmount)}</td>
                    <td className="p-4">
                      <Badge label={order.paymentStatus} type={paymentBadge(order.paymentStatus)} />
                    </td>
                    <td className="p-4">
                      <Badge
                        label={order.fulfillmentStatus}
                        type={order.fulfillmentStatus === "FULFILLED" ? "blue" : "gray"}
                      />
                    </td>
                    <td className="p-4">
                      <Badge
                        label={order.deliveryStatus}
                        type={order.deliveryStatus === "DELIVERED" ? "green" : order.deliveryStatus === "DISPATCHED" ? "blue" : "gray"}
                      />
                    </td>
                    <td className="p-4">
                      <Badge
                        label={order.orderStatus}
                        type={order.orderStatus === "COMPLETED" ? "green" : order.orderStatus === "ACTIVE" ? "gray" : "red"}
                      />
                    </td>
                    <td className="p-4 text-neutral-500">
                      {new Date(order.createdAt).toLocaleDateString("en-LK")}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Badge({
  label,
  type,
}: {
  label: string;
  type: "blue" | "gray" | "green" | "red" | "yellow";
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(type)}`}>
      {label}
    </span>
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
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
      />
    </label>
  );
}

function AddressFields({
  addresses,
  onChange,
}: {
  addresses: CustomerForm["addresses"];
  onChange: (addresses: CustomerForm["addresses"]) => void;
}) {
  function updateAddress(
    index: number,
    values: Partial<CustomerForm["addresses"][number]>
  ) {
    onChange(
      addresses.map((address, addressIndex) =>
        addressIndex === index ? { ...address, ...values } : address
      )
    );
  }

  function setDefault(index: number) {
    onChange(
      addresses.map((address, addressIndex) => ({
        ...address,
        isDefault: addressIndex === index,
      }))
    );
  }

  function removeAddress(index: number) {
    const nextAddresses = addresses.filter(
      (_, addressIndex) => addressIndex !== index
    );

    if (nextAddresses.length > 0 && !nextAddresses.some((item) => item.isDefault)) {
      nextAddresses[0] = {
        ...nextAddresses[0],
        isDefault: true,
      };
    }

    onChange(nextAddresses);
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-neutral-500">
          Addresses
        </span>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...addresses,
              {
                label: "",
                address: "",
                isDefault: addresses.length === 0,
              },
            ])
          }
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          Add address
        </button>
      </div>
      {addresses.map((address, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[160px_1fr_auto]"
        >
          <input
            value={address.label}
            onChange={(event) => updateAddress(index, { label: event.target.value })}
            placeholder="Label"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
          />
          <textarea
            rows={2}
            value={address.address}
            onChange={(event) => updateAddress(index, { address: event.target.value })}
            placeholder="Address"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
          />
          <div className="flex items-center gap-2 md:flex-col md:items-stretch">
            <button
              type="button"
              onClick={() => setDefault(index)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                address.isDefault
                  ? "border-[#FFBF01] bg-[#FFBF01]/20 text-neutral-950"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Default
            </button>
            <button
              type="button"
              disabled={addresses.length === 1}
              onClick={() => removeAddress(index)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
