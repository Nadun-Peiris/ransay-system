"use client";

import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

type CustomerType = "VAT" | "NON_VAT";
type CustomerStatus = "active" | "inactive" | "all";

type CustomerRow = {
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
};

type CustomersMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
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
};

const emptyForm: CustomerForm = {
  customerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  addresses: [{ label: "Primary", address: "", isDefault: true }],
  customerType: "NON_VAT",
  vatNumber: "",
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getBadgeClass(type: "blue" | "gray" | "green" | "red") {
  const classes = {
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-neutral-100 text-neutral-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
  };

  return classes[type];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [meta, setMeta] = useState<CustomersMeta | null>(null);
  const [q, setQ] = useState("");
  const [customerType, setCustomerType] = useState<"" | CustomerType>("");
  const [status, setStatus] = useState<CustomerStatus>("active");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      status,
    });

    if (debouncedQ.trim()) {
      params.set("q", debouncedQ.trim());
    }

    if (customerType) {
      params.set("customerType", customerType);
    }

    return params.toString();
  }, [customerType, debouncedQ, page, status]);

  async function fetchCustomers() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/customers?${queryString}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load customers.");
      }

      setCustomers(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error("Failed to load customers:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to load customers."
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
    void fetchCustomers();
  }, [queryString]);

  function clearFilters() {
    setQ("");
    setDebouncedQ("");
    setCustomerType("");
    setStatus("active");
    setPage(1);
  }

  function closeCreateModal() {
    if (isSaving) return;

    setIsCreateOpen(false);
    setForm(emptyForm);
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      setIsSaving(true);

      const response = await fetch("/api/customers", {
        method: "POST",
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
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create customer.");
      }

      setMessage("Customer created successfully.");
      setIsCreateOpen(false);
      setForm(emptyForm);
      await fetchCustomers();
    } catch (error) {
      console.error("Failed to create customer:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to create customer."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleCustomerStatus(customer: CustomerRow) {
    const nextStatus = !customer.isActive;

    try {
      setMessage(null);
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: nextStatus,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update customer.");
      }

      setMessage(
        nextStatus
          ? "Customer activated successfully."
          : "Customer deactivated successfully."
      );
      await fetchCustomers();
    } catch (error) {
      console.error("Failed to update customer status:", error);
      setMessage(
        error instanceof Error ? error.message : "Failed to update customer."
      );
    }
  }

  return (
    <main className="p-6 text-black">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">
            Customers
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage VAT and NON-VAT customers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#e5ab00]"
        >
          Add Customer
        </button>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#FFBF01]/30 bg-[#FFBF01]/10 px-4 py-3 text-sm font-medium text-yellow-900">
          {message}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Search
            </span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Company, contact person, phone, email, VAT no"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Customer type
            </span>
            <select
              value={customerType}
              onChange={(event) => {
                setCustomerType(event.target.value as "" | CustomerType);
                setPage(1);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            >
              <option value="">All types</option>
              <option value="VAT">VAT</option>
              <option value="NON_VAT">NON-VAT</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Status
            </span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CustomerStatus);
                setPage(1);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-neutral-50 px-5 py-4">
          <p className="text-sm font-medium text-neutral-700">
            {meta?.totalCount ?? 0} total customer
            {(meta?.totalCount ?? 0) === 1 ? "" : "s"}
          </p>
          {isLoading && <p className="text-sm text-neutral-500">Loading...</p>}
        </div>

        {isLoading && customers.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="p-4">Company</th>
                  <th className="p-4">Contact Person</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">VAT No</th>
                  <th className="p-4">Orders</th>
                  <th className="p-4">Total Sales</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b last:border-b-0">
                    <td className="p-4">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-neutral-950 underline decoration-transparent underline-offset-4 hover:text-[#C8942A] hover:decoration-[#C8942A]"
                      >
                        {customer.customerName}
                      </Link>
                      {customer.customerCode && (
                        <p className="mt-0.5 text-xs font-medium text-neutral-500">
                          ID: {customer.customerCode}
                        </p>
                      )}
                      {customer.address && (
                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-neutral-500">
                          {customer.address}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-neutral-600">
                      {customer.contactPerson || "-"}
                    </td>
                    <td className="p-4 text-neutral-600">
                      <p>{customer.phone || "-"}</p>
                      <p className="mt-0.5 text-xs">{customer.email || "-"}</p>
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          customer.customerType === "VAT"
                            ? getBadgeClass("blue")
                            : getBadgeClass("gray")
                        }`}
                      >
                        {customer.customerType === "VAT" ? "VAT" : "NON-VAT"}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-600">
                      {customer.vatNumber || "-"}
                    </td>
                    <td className="p-4 font-medium">{customer.orderCount}</td>
                    <td className="p-4 font-medium">
                      {formatMoney(customer.totalSalesAmount)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          customer.isActive
                            ? getBadgeClass("green")
                            : getBadgeClass("red")
                        }`}
                      >
                        {customer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-500">
                      {new Date(customer.createdAt).toLocaleDateString("en-LK")}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                          View/Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleCustomerStatus(customer)}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                            customer.isActive
                              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {customer.isActive ? "Deactivate" : "Activate"}
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

      {isCreateOpen && (
        <CustomerModal
          form={form}
          isSaving={isSaving}
          onClose={closeCreateModal}
          onSubmit={handleCreateCustomer}
          onChange={setForm}
        />
      )}
    </main>
  );
}

function CustomerModal({
  form,
  isSaving,
  onClose,
  onSubmit,
  onChange,
}: {
  form: CustomerForm;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: Dispatch<SetStateAction<CustomerForm>>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Add Customer
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Create a customer for orders and sales tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <TextInput
            label="Company Name"
            value={form.customerName}
            onChange={(value) =>
              onChange((current) => ({ ...current, customerName: value }))
            }
            required
          />
          <TextInput
            label="Contact Person"
            value={form.contactPerson}
            onChange={(value) =>
              onChange((current) => ({ ...current, contactPerson: value }))
            }
          />
          <TextInput
            label="Phone"
            value={form.phone}
            onChange={(value) => onChange((current) => ({ ...current, phone: value }))}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => onChange((current) => ({ ...current, email: value }))}
          />
          <AddressFields
            addresses={form.addresses}
            onChange={(addresses) =>
              onChange((current) => ({ ...current, addresses }))
            }
          />
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Customer Type
            </span>
            <select
              value={form.customerType}
              onChange={(event) =>
                onChange((current) => ({
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
              onChange={(value) =>
                onChange((current) => ({ ...current, vatNumber: value }))
              }
              required
            />
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 md:col-span-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
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
              {isSaving ? "Saving..." : "Create customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
            value={address.address}
            onChange={(event) => updateAddress(index, { address: event.target.value })}
            rows={2}
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
