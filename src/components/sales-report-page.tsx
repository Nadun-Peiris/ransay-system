/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { SalesLineChart } from "@/components/charts/sales-line-chart";

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

type SalesReportData = {
  mode: "TOTAL_SALES" | "SELECTED_ORDERS_SALES";
  summary: {
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    totalOrderCount: number;
    vatOrderCount: number;
    nonVatOrderCount: number;
    averageOrderValue: number;
  };
  paymentBreakdown: {
    paidAmount: number;
    pendingAmount: number;
    dueAmount: number;
    overdueAmount: number;
    paidCount: number;
    pendingCount: number;
    dueCount: number;
    overdueCount: number;
  };
  dailySales: {
    date: string;
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    orderCount: number;
  }[];
  recentOrders: {
    id: string;
    orderId: string;
    vatOrderId: string | null;
    nonVatOrderId: string | null;
    customerName: string;
    orderType: "VAT" | "NON_VAT";
    totalAmount: number;
    paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
    fulfillmentStatus: "UNFULFILLED" | "FULFILLED";
    deliveryStatus: "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
    orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
    createdAt: string;
  }[];
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  orderType: string;
  paymentStatus: string;
  createdByRole: string;
};

const emptyFilters: FilterState = {
  dateFrom: "",
  dateTo: "",
  orderType: "",
  paymentStatus: "",
  createdByRole: "",
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCount(value: number) {
  return value.toLocaleString("en-LK");
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

function getPaymentBadgeColor(status: SalesReportData["recentOrders"][number]["paymentStatus"]) {
  if (status === "PAID") return "green";
  if (status === "DUE") return "yellow";
  if (status === "OVERDUE") return "red";
  return "gray";
}

function getFulfillmentBadgeColor(
  status: SalesReportData["recentOrders"][number]["fulfillmentStatus"]
) {
  if (status === "FULFILLED") return "blue";
  return "gray";
}

function getDeliveryBadgeColor(status: SalesReportData["recentOrders"][number]["deliveryStatus"]) {
  if (status === "DELIVERED") return "green";
  if (status === "DISPATCHED") return "blue";
  return "gray";
}

function getOrderBadgeColor(status: SalesReportData["recentOrders"][number]["orderStatus"]) {
  if (status === "COMPLETED") return "green";
  if (status === "DELETED" || status === "CANCELLED") return "red";
  return "gray";
}

function buildReportQuery(filters: FilterState) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export function SalesReportPage({
  title,
  subtitle,
  endpoint,
  superadminOnly = false,
  showCreatedByFilter = true,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  superadminOnly?: boolean;
  showCreatedByFilter?: boolean;
}) {
  const router = useRouter();
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(emptyFilters);
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(
    () => buildReportQuery(appliedFilters),
    [appliedFilters]
  );

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);

      const meResponse = await fetch("/api/auth/me");
      const meResult = await meResponse.json();

      if (!meResponse.ok || !meResult.success) {
        throw new Error(meResult.message || "Failed to load current user.");
      }

      const currentUser = meResult.data as CurrentUser;

      if (superadminOnly && currentUser.role !== "SUPERADMIN") {
        router.replace("/analytics/sales");
        return;
      }

      const response = await fetch(
        `${endpoint}${queryString ? `?${queryString}` : ""}`
      );
      const result = await response.json();

      if (response.status === 403) {
        router.replace("/analytics/sales");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load sales report.");
      }

      setReport(result.data as SalesReportData);
    } catch (error) {
      console.error("Failed to load sales report:", error);
      alert(
        error instanceof Error ? error.message : "Failed to load sales report."
      );
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, queryString, router, superadminOnly]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const summary = report?.summary;
  const paymentBreakdown = report?.paymentBreakdown;

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          {title}
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500">{subtitle}</p>
      </div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div
          className={`grid gap-4 md:grid-cols-2 ${
            showCreatedByFilter ? "xl:grid-cols-5" : "xl:grid-cols-4"
          }`}
        >
          <DateInput
            label="Date From"
            value={filters.dateFrom}
            onChange={(value) => updateFilter("dateFrom", value)}
          />
          <DateInput
            label="Date To"
            value={filters.dateTo}
            onChange={(value) => updateFilter("dateTo", value)}
          />
          <FilterSelect
            label="Order Type"
            value={filters.orderType}
            onChange={(value) => updateFilter("orderType", value)}
            options={[
              ["VAT", "VAT"],
              ["NON_VAT", "NON-VAT"],
            ]}
          />
          <FilterSelect
            label="Payment Status"
            value={filters.paymentStatus}
            onChange={(value) => updateFilter("paymentStatus", value)}
            options={[
              ["PAID", "Paid"],
              ["PENDING", "Pending"],
              ["DUE", "Due"],
              ["OVERDUE", "Overdue"],
            ]}
          />
          {showCreatedByFilter && (
            <FilterSelect
              label="Created By"
              value={filters.createdByRole}
              onChange={(value) => updateFilter("createdByRole", value)}
              options={[
                ["ADMIN", "Admin"],
                ["SUPERADMIN", "Superadmin"],
              ]}
            />
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-[#FFBF01] px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
          >
            Apply Filters
          </button>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Total Sales" value={formatMoney(summary?.totalSalesAmount ?? 0)} />
        <SummaryCard label="VAT Sales" value={formatMoney(summary?.vatSalesAmount ?? 0)} />
        <SummaryCard label="NON-VAT Sales" value={formatMoney(summary?.nonVatSalesAmount ?? 0)} />
        <SummaryCard label="Total Orders" value={formatCount(summary?.totalOrderCount ?? 0)} />
        <SummaryCard label="Average Order Value" value={formatMoney(summary?.averageOrderValue ?? 0)} />
        <SummaryCard label="Paid Amount" value={formatMoney(paymentBreakdown?.paidAmount ?? 0)} />
        <SummaryCard label="Pending Amount" value={formatMoney(paymentBreakdown?.pendingAmount ?? 0)} />
        <SummaryCard label="Due Amount" value={formatMoney(paymentBreakdown?.dueAmount ?? 0)} />
        <SummaryCard label="Overdue Amount" value={formatMoney(paymentBreakdown?.overdueAmount ?? 0)} />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={title === "Sales" ? "Daily Selected Sales" : "Daily Sales"}
          description="Sales trend split by VAT and NON-VAT orders."
        >
          <SalesLineChart
            data={(report?.dailySales ?? []).map((row) => ({
              date: row.date,
              totalSalesAmount: row.totalSalesAmount,
              vatSalesAmount: row.vatSalesAmount,
              nonVatSalesAmount: row.nonVatSalesAmount,
            }))}
            lines={[
              {
                key: "totalSalesAmount",
                name: "Total Sales",
                color: "#2563eb",
              },
              { key: "vatSalesAmount", name: "VAT Sales", color: "#16a34a" },
              {
                key: "nonVatSalesAmount",
                name: "NON-VAT Sales",
                color: "#6b7280",
              },
            ]}
          />
        </ChartCard>

        <ChartCard title="VAT vs NON-VAT Sales">
          <BreakdownPieChart
            data={[
              { name: "VAT", amount: summary?.vatSalesAmount ?? 0 },
              { name: "NON-VAT", amount: summary?.nonVatSalesAmount ?? 0 },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Payment Breakdown">
          <BreakdownPieChart
            data={[
              { name: "Paid", amount: paymentBreakdown?.paidAmount ?? 0 },
              {
                name: "Pending",
                amount: paymentBreakdown?.pendingAmount ?? 0,
              },
              { name: "Due", amount: paymentBreakdown?.dueAmount ?? 0 },
              {
                name: "Overdue",
                amount: paymentBreakdown?.overdueAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <BreakdownPanel
          title="VAT vs NON-VAT Breakdown"
          rows={[
            {
              label: "VAT",
              amount: summary?.vatSalesAmount ?? 0,
              count: summary?.vatOrderCount ?? 0,
            },
            {
              label: "NON-VAT",
              amount: summary?.nonVatSalesAmount ?? 0,
              count: summary?.nonVatOrderCount ?? 0,
            },
          ]}
        />
        <BreakdownPanel
          title="Payment Breakdown"
          rows={[
            {
              label: "Paid",
              amount: paymentBreakdown?.paidAmount ?? 0,
              count: paymentBreakdown?.paidCount ?? 0,
            },
            {
              label: "Pending",
              amount: paymentBreakdown?.pendingAmount ?? 0,
              count: paymentBreakdown?.pendingCount ?? 0,
            },
            {
              label: "Due",
              amount: paymentBreakdown?.dueAmount ?? 0,
              count: paymentBreakdown?.dueCount ?? 0,
            },
            {
              label: "Overdue",
              amount: paymentBreakdown?.overdueAmount ?? 0,
              count: paymentBreakdown?.overdueCount ?? 0,
            },
          ]}
        />
      </section>

      <DailySalesTable rows={report?.dailySales ?? []} isLoading={isLoading} />
      <RecentOrdersTable rows={report?.recentOrders ?? []} isLoading={isLoading} />
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-black">{value}</p>
    </div>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; amount: number; count: number }[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-bold text-black">{row.label}</p>
              <p className="text-xs font-medium text-stone-500">
                {formatCount(row.count)} order{row.count === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-right text-sm font-bold text-black">
              {formatMoney(row.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DailySalesTable({
  rows,
  isLoading,
}: {
  rows: SalesReportData["dailySales"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Daily Sales</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading daily sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No daily sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Total Sales</th>
                <th className="p-4 font-medium">VAT Sales</th>
                <th className="p-4 font-medium">NON-VAT Sales</th>
                <th className="p-4 font-medium">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-black">{row.date}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.totalSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.vatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.nonVatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatCount(row.orderCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentOrdersTable({
  rows,
  isLoading,
}: {
  rows: SalesReportData["recentOrders"];
  isLoading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Recent Orders</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading recent orders..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No recent orders found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-295 text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Fulfillment</th>
                <th className="p-4 font-medium">Delivery</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-stone-50/60">
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
                  <td className="p-4 font-medium text-black">{order.customerName}</td>
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
                  <td className="p-4 font-bold text-black">{formatMoney(order.totalAmount)}</td>
                  <td className="p-4">
                    <Badge label={order.paymentStatus} color={getPaymentBadgeColor(order.paymentStatus)} />
                  </td>
                  <td className="p-4">
                    <Badge label={order.fulfillmentStatus} color={getFulfillmentBadgeColor(order.fulfillmentStatus)} />
                  </td>
                  <td className="p-4">
                    <Badge label={order.deliveryStatus} color={getDeliveryBadgeColor(order.deliveryStatus)} />
                  </td>
                  <td className="p-4">
                    <Badge label={order.orderStatus} color={getOrderBadgeColor(order.orderStatus)} />
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
    </section>
  );
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: "green" | "yellow" | "red" | "blue" | "gray";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
        color
      )}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm font-medium text-stone-500">{label}</div>;
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase text-stone-500">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
      />
    </label>
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
