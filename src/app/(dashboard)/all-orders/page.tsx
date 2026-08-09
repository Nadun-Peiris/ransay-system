"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string;
  orderId: string;
  vatOrderId: string | null;
  nonVatOrderId: string | null;
  createdByRole: "ADMIN" | "SUPERADMIN";
  isSelected: boolean;
  customerName: string;
  customerPhone: string | null;
  orderType: "VAT" | "NON_VAT";
  totalAmount: number;
  orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
  paymentType: "PAID_NOW" | "CREDIT";
  paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  displayPaymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  fulfillmentStatus: "UNFULFILLED" | "FULFILLED";
  deliveryStatus: "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
  paymentDueDate: string | null;
  deletedAt: string | null;
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

type OrdersMeta = {
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
  orderStatus: string;
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
  orderStatus: "",
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
    green: "bg-emerald-100 text-emerald-800",
    yellow: "bg-[#FFBF01]/20 text-yellow-900",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-stone-200 text-stone-700",
  };

  return classes[type];
}

function getPaymentBadgeColor(status: OrderRow["displayPaymentStatus"]) {
  if (status === "PAID") return "green";
  if (status === "DUE") return "yellow";
  if (status === "OVERDUE") return "red";
  return "gray";
}

function getFulfillmentBadgeColor(status: OrderRow["fulfillmentStatus"]) {
  if (status === "FULFILLED") return "blue";
  return "gray";
}

function getDeliveryBadgeColor(status: OrderRow["deliveryStatus"]) {
  if (status === "DELIVERED") return "green";
  if (status === "DISPATCHED") return "blue";
  return "gray";
}

function getOrderBadgeColor(status: OrderRow["orderStatus"]) {
  if (status === "COMPLETED") return "green";
  if (status === "DELETED" || status === "CANCELLED") return "red";
  return "gray";
}

function buildOrdersQuery(filters: FilterState, page: number) {
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

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<OrdersMeta | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] =
    useState<FilterState>(emptyFilters);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(
    () => buildOrdersQuery(debouncedFilters, page),
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

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);

      const meResponse = await fetch("/api/auth/me");
      const meResult = await meResponse.json();

      if (!meResponse.ok || !meResult.success) {
        throw new Error(meResult.message || "Failed to load current user.");
      }

      const currentUser = meResult.data as CurrentUser;

      if (currentUser.role !== "SUPERADMIN") {
        router.replace("/orders");
        return;
      }

      const response = await fetch(`/api/orders?${queryString}`);
      const result = await response.json();

      if (response.status === 403) {
        router.replace("/orders");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load orders.");
      }

      setOrders(result.data);
      setMeta(result.meta);
    } catch (error) {
      console.error("Failed to load orders:", error);
      alert(
        error instanceof Error ? error.message : "Failed to load orders."
      );
    } finally {
      setIsLoading(false);
    }
  }, [queryString, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFBF01] text-black shadow-sm">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">
              All Orders
            </h1>
            <p className="mt-1 text-sm font-medium text-stone-500">
              Search, filter, and open every order record.
            </p>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-stone-500">
              Search
            </span>
            <input
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="Order ID, customer, phone"
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
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
            label="Order status"
            value={filters.orderStatus}
            onChange={(value) => updateFilter("orderStatus", value)}
            options={[
              ["ACTIVE", "ACTIVE"],
              ["COMPLETED", "COMPLETED"],
              ["CANCELLED", "CANCELLED"],
              ["DELETED", "DELETED"],
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
            <span className="text-xs font-bold uppercase text-stone-500">
              Date from
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-stone-500">
              Date to
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-stone-200 bg-stone-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-stone-700">
            {meta?.totalCount ?? 0} total order
            {(meta?.totalCount ?? 0) === 1 ? "" : "s"}
          </p>
          {isLoading && (
            <p className="text-sm font-medium text-stone-500">Loading...</p>
          )}
        </div>

        {isLoading && orders.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-stone-500">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-stone-500">
            No orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="p-4 font-medium">Order</th>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Created By</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Payment Status</th>
                  <th className="p-4 font-medium">Fulfillment Status</th>
                  <th className="p-4 font-medium">Delivery Status</th>
                  <th className="p-4 font-medium">Order Status</th>
                  <th className="p-4 font-medium">Items</th>
                  <th className="p-4 font-medium">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-stone-50/60"
                  >
                    <td className="p-4">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-bold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                      >
                        {order.orderId}
                      </Link>
                      <p className="mt-0.5 text-xs font-medium text-stone-500">
                        {order.vatOrderId ?? order.nonVatOrderId}
                      </p>
                    </td>

                    <td className="p-4">
                      <p className="font-medium text-black">
                        {order.customerName}
                      </p>
                      {order.customerPhone && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          {order.customerPhone}
                        </p>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          order.createdByRole === "SUPERADMIN"
                            ? getBadgeClass("blue")
                            : getBadgeClass("green")
                        }`}
                      >
                        {order.createdByRole}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                            order.orderType === "VAT"
                              ? getBadgeClass("blue")
                              : getBadgeClass("gray")
                          }`}
                        >
                          {order.orderType === "VAT" ? "VAT" : "NON-VAT"}
                        </span>

                        {order.createdByRole === "SUPERADMIN" &&
                          order.orderType === "NON_VAT" && (
                            <span
                              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                                order.isSelected
                                  ? getBadgeClass("green")
                                  : getBadgeClass("yellow")
                              }`}
                            >
                              {order.isSelected ? "SELECTED" : "NOT SELECTED"}
                            </span>
                          )}
                      </div>
                    </td>

                    <td className="p-4 font-bold text-black">
                      {formatMoney(order.totalAmount)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
                          getPaymentBadgeColor(order.displayPaymentStatus)
                        )}`}
                      >
                        {order.displayPaymentStatus}
                      </span>

                      {order.paymentType === "CREDIT" &&
                        order.paymentDueDate && (
                          <p className="mt-1.5 text-xs font-medium text-stone-500">
                            Due:{" "}
                            <span className="text-stone-700">
                              {new Date(
                                order.paymentDueDate
                              ).toLocaleDateString("en-LK")}
                            </span>
                          </p>
                        )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
                          getFulfillmentBadgeColor(order.fulfillmentStatus)
                        )}`}
                      >
                        {order.fulfillmentStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
                          getDeliveryBadgeColor(order.deliveryStatus)
                        )}`}
                      >
                        {order.deliveryStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
                          getOrderBadgeColor(order.orderStatus)
                        )}`}
                      >
                        {order.orderStatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <p className="font-medium text-black">
                        {order.items.length} item(s)
                      </p>
                      <p className="mt-0.5 max-w-[200px] truncate text-xs text-stone-500">
                        {order.items.map((item) => item.productName).join(", ")}
                      </p>
                    </td>

                    <td className="p-4 font-medium text-stone-500">
                      {new Date(order.createdAt).toLocaleDateString("en-LK", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="flex flex-col gap-3 border-t border-stone-200 p-4 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              disabled={meta.page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <p className="text-center text-sm text-stone-500">
              Page {meta.page} of {Math.max(meta.totalPages, 1)}
            </p>

            <button
              type="button"
              disabled={meta.page >= meta.totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
      <span className="text-xs font-bold uppercase text-stone-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
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
