"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SelectedOrderRow = {
  selectedVisibleId: string;
  id: string;
  orderId: string;
  vatOrderId: string | null;
  nonVatOrderId: string | null;
  createdByRole: "ADMIN" | "SUPERADMIN";
  customerName: string;
  customerPhone: string | null;
  orderType: "VAT" | "NON_VAT";
  isSelected: boolean;
  totalAmount: number;
  orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
  paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  fulfillmentStatus: "UNFULFILLED" | "FULFILLED";
  deliveryStatus: "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
  createdAt: string;
  items: {
    id: string;
    productName: string;
    quantityBags: number;
    quantityKg: number;
    pricePerKg: number;
    lineTotal: number;
  }[];
};

type SelectedOrdersMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

type FilterState = {
  q: string;
  orderType: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  createdByRole: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: FilterState = {
  q: "",
  orderType: "",
  paymentStatus: "",
  fulfillmentStatus: "",
  deliveryStatus: "",
  createdByRole: "",
  dateFrom: "",
  dateTo: "",
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getBadgeClass(type: "green" | "yellow" | "red" | "blue" | "gray") {
  const classes = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-neutral-100 text-neutral-700",
  };

  return classes[type];
}

function getFulfillmentBadgeType(status: SelectedOrderRow["fulfillmentStatus"]) {
  if (status === "FULFILLED") return "blue";
  return "gray";
}

function getPaymentBadgeType(status: SelectedOrderRow["paymentStatus"]) {
  if (status === "PAID") return "green";
  if (status === "DUE") return "yellow";
  if (status === "OVERDUE") return "red";
  return "gray";
}

function getDeliveryBadgeType(status: SelectedOrderRow["deliveryStatus"]) {
  if (status === "DELIVERED") return "green";
  if (status === "DISPATCHED") return "blue";
  return "gray";
}

function getOrderBadgeType(status: SelectedOrderRow["orderStatus"]) {
  if (status === "COMPLETED") return "green";
  if (status === "CANCELLED" || status === "DELETED") return "red";
  return "gray";
}

function buildSelectedOrdersQuery(filters: FilterState, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export default function SelectedOrdersPage() {
  const [orders, setOrders] = useState<SelectedOrderRow[]>([]);
  const [meta, setMeta] = useState<SelectedOrdersMeta | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] =
    useState<FilterState>(emptyFilters);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const isSuperadmin = currentUser?.role === "SUPERADMIN";
  const pageTitle = "Orders";

  const queryString = useMemo(
    () => buildSelectedOrdersQuery(debouncedFilters, page),
    [debouncedFilters, page]
  );

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setDebouncedFilters(emptyFilters);
    setPage(1);
  };

  async function fetchSelectedOrders() {
    try {
      setIsLoading(true);

      const meResponse = await fetch("/api/auth/me");
      const meResult = await meResponse.json();

      if (!meResponse.ok || !meResult.success) {
        throw new Error(meResult.message || "Failed to load current user.");
      }

      setCurrentUser(meResult.data as CurrentUser);

      const response = await fetch(`/api/selected-orders?${queryString}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load orders.");
      }

      setOrders(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error("Failed to load orders:", error);
      alert(error instanceof Error ? error.message : "Failed to load orders.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    void fetchSelectedOrders();
  }, [queryString]);

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isSuperadmin
              ? "Visible active order records with dynamic SEL numbers."
              : "View available active orders."}
          </p>
        </div>

        {isSuperadmin && (
          <Link
            href="/all-orders"
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            View all orders
          </Link>
        )}
      </div>

      <section
        className={`mb-6 grid gap-4 ${
          isSuperadmin ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">
            {isSuperadmin ? "Total visible records" : "Total orders"}
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {meta?.totalCount ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Current page</p>
          <p className="mt-2 text-2xl font-semibold">{meta?.page ?? 1}</p>
        </div>

        {isSuperadmin && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-neutral-500">SEL numbering</p>
            <p className="mt-2 text-sm font-medium text-neutral-800">
              Generated dynamically
            </p>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Search
            </span>
            <input
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="Order ID, customer, phone"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
          </label>

          <FilterSelect
            label="Order type"
            value={filters.orderType}
            onChange={(value) => updateFilter("orderType", value)}
            options={[
              ["VAT", "VAT"],
              ["NON_VAT", "NON-VAT"],
            ]}
          />

          <FilterSelect
            label="Payment status"
            value={filters.paymentStatus}
            onChange={(value) => updateFilter("paymentStatus", value)}
            options={[
              ["PENDING", "PENDING"],
              ["DUE", "DUE"],
              ["OVERDUE", "OVERDUE"],
              ["PAID", "PAID"],
            ]}
          />

          <FilterSelect
            label="Fulfillment status"
            value={filters.fulfillmentStatus}
            onChange={(value) => updateFilter("fulfillmentStatus", value)}
            options={[
              ["UNFULFILLED", "UNFULFILLED"],
              ["FULFILLED", "FULFILLED"],
            ]}
          />

          <FilterSelect
            label="Delivery status"
            value={filters.deliveryStatus}
            onChange={(value) => updateFilter("deliveryStatus", value)}
            options={[
              ["NOT_DISPATCHED", "NOT DISPATCHED"],
              ["DISPATCHED", "DISPATCHED"],
              ["DELIVERED", "DELIVERED"],
            ]}
          />

          <FilterSelect
            label="Created by"
            value={filters.createdByRole}
            onChange={(value) => updateFilter("createdByRole", value)}
            options={[
              ["ADMIN", "ADMIN"],
              ["SUPERADMIN", "SUPERADMIN"],
            ]}
          />

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Date from
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              Date to
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
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
        <div className="flex flex-col gap-2 border-b bg-neutral-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {meta?.totalCount ?? 0} total order
            {(meta?.totalCount ?? 0) === 1 ? "" : "s"}
          </p>
          {isLoading && (
            <p className="text-sm text-neutral-500">Loading...</p>
          )}
        </div>

        {isLoading && orders.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            No orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className={`w-full text-left text-sm ${
                isSuperadmin ? "min-w-[1320px]" : "min-w-[1220px]"
              }`}
            >
              <thead className="border-b bg-neutral-50 text-neutral-600">
                <tr>
                  {isSuperadmin && <th className="p-4">SEL ID</th>}
                  <th className="p-4">Order</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Created By</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Payment Status</th>
                  <th className="p-4">Fulfillment Status</th>
                  <th className="p-4">Delivery Status</th>
                  <th className="p-4">Order Status</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-b-0">
                    {isSuperadmin && (
                      <td className="p-4">
                        <span className="font-semibold text-neutral-900">
                          {order.selectedVisibleId}
                        </span>
                      </td>
                    )}

                    <td className="p-4">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-semibold text-neutral-950 underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                      >
                        {order.orderId}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {order.vatOrderId ?? order.nonVatOrderId}
                      </p>
                    </td>

                    <td className="p-4">
                      <p>{order.customerName}</p>
                      {order.customerPhone && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {order.customerPhone}
                        </p>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          order.createdByRole === "ADMIN"
                            ? getBadgeClass("green")
                            : getBadgeClass("blue")
                        }`}
                      >
                        {order.createdByRole}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          order.orderType === "VAT"
                            ? getBadgeClass("blue")
                            : getBadgeClass("gray")
                        }`}
                      >
                        {order.orderType === "VAT" ? "VAT" : "NON-VAT"}
                      </span>
                    </td>

                    <td className="p-4 font-medium">
                      {formatMoney(order.totalAmount)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getBadgeClass(
                          getPaymentBadgeType(order.paymentStatus)
                        )}`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getBadgeClass(
                          getFulfillmentBadgeType(order.fulfillmentStatus)
                        )}`}
                      >
                        {order.fulfillmentStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getBadgeClass(
                          getDeliveryBadgeType(order.deliveryStatus)
                        )}`}
                      >
                        {order.deliveryStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getBadgeClass(
                          getOrderBadgeType(order.orderStatus)
                        )}`}
                      >
                        {order.orderStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <p>{order.items.length} item(s)</p>
                      <p className="max-w-[220px] truncate text-xs text-neutral-500">
                        {order.items.map((item) => item.productName).join(", ")}
                      </p>
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
      >
        <option value="">All</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
