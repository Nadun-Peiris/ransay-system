"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { SalesLineChart } from "@/components/charts/sales-line-chart";
import { SkeletonTable } from "@/components/skeleton";
import { showToast } from "@/components/toast-provider";
import { formatCurrency, formatDate } from "@/lib/formatters";

type OrderType = "VAT" | "NON_VAT";
type PaymentStatus = "PENDING" | "DUE" | "OVERDUE" | "PAID";
type CollectionStatus = "UPCOMING" | "DUE_TODAY" | "OVERDUE";

type ReceivablesReport = {
  mode: "SELECTED_RECEIVABLES";
  selectedMonth: number;
  selectedYear: number;
  thresholdAmount: number | null;
  summary: {
    projectedReceivableAmount: number;
    totalReceivableCount: number;
    thresholdAmount: number | null;
    thresholdExceeded: boolean;
    excessAmount: number;
    amountAfterSuggestedUnselect: number;
    suggestedReductionAmount: number;
    remainingExcessAfterSuggestions: number;
    upcomingAmount: number;
    dueTodayAmount: number;
    overdueAmount: number;
    upcomingCount: number;
    dueTodayCount: number;
    overdueCount: number;
    nearestDueDate: string | null;
    highestReceivableCustomerName: string | null;
  };
  thresholdPlan: {
    thresholdExceeded: boolean;
    excessAmount: number;
    canFullyMeetThreshold: boolean;
    suggestedUnselectOrderIds: string[];
    suggestedUnselectAmount: number;
    projectedAfterUnselect: number;
    remainingExcessAfterSuggestions: number;
  };
  monthlyReceivables: {
    month: number;
    year: number;
    label: string;
    totalAmount: number;
    orderCount: number;
    upcomingAmount: number;
    dueTodayAmount: number;
    overdueAmount: number;
  }[];
  dailyReceivables: {
    date: string;
    totalAmount: number;
    orderCount: number;
    upcomingAmount: number;
    dueTodayAmount: number;
    overdueAmount: number;
  }[];
  customerReceivables: {
    customerId: string;
    customerName: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    totalAmount: number;
    orderCount: number;
    nearestDueDate: string | null;
    overdueAmount: number;
    upcomingAmount: number;
  }[];
  orderTypeBreakdown: {
    vatAmount: number;
    nonVatAmount: number;
    vatCount: number;
    nonVatCount: number;
  };
  statusBreakdown: {
    upcomingAmount: number;
    dueTodayAmount: number;
    overdueAmount: number;
    upcomingCount: number;
    dueTodayCount: number;
    overdueCount: number;
  };
  receivableOrders: {
    id: string;
    orderId: string;
    vatOrderId: string | null;
    nonVatOrderId: string | null;
    displayOrderId: string;
    customerId: string;
    customerName: string;
    contactPerson: string | null;
    phone: string | null;
    orderType: OrderType;
    createdByRole: "ADMIN" | "SUPERADMIN";
    isSelected: boolean;
    canUnselect: boolean;
    suggestedForUnselect: boolean;
    totalAmount: number;
    paymentStatus: PaymentStatus;
    orderDate: string;
    dueDate: string;
    createdAt: string;
    collectionStatus: CollectionStatus;
    daysUntilDue: number;
    daysOverdue: number;
  }[];
};

type Customer = {
  id: string;
  customerName: string;
};

type FilterState = {
  month: string;
  year: string;
  threshold: string;
  orderType: string;
  paymentStatus: string;
  customerId: string;
  createdByRole: string;
};

const currentDate = new Date();
const defaultFilters: FilterState = {
  month: String(currentDate.getMonth() + 1),
  year: String(currentDate.getFullYear()),
  threshold: "",
  orderType: "",
  paymentStatus: "",
  customerId: "",
  createdByRole: "",
};

const months = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

function formatEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
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

function getStatusBadgeClass(status: CollectionStatus) {
  const classes = {
    UPCOMING: "bg-blue-100 text-blue-800",
    DUE_TODAY: "bg-amber-100 text-amber-800",
    OVERDUE: "bg-red-100 text-red-800",
  };

  return classes[status];
}

function getLockReason(order: ReceivablesReport["receivableOrders"][number]) {
  if (order.canUnselect) return "";
  if (order.createdByRole === "ADMIN") return "Admin order";
  if (order.orderType === "VAT") return "VAT order";
  if (!order.isSelected) return "Not selected";
  if (order.paymentStatus === "PAID") return "Already paid";

  return "Not eligible";
}

export default function ReceivablesPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(defaultFilters);
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  const clearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const suffix = queryString ? `?${queryString}` : "";
      const [reportResponse, customersResponse] = await Promise.all([
        fetch(`/api/reports/receivables${suffix}`),
        fetch("/api/customers?status=all&limit=100"),
      ]);
      const reportResult = await reportResponse.json();

      if (!reportResponse.ok || !reportResult.success) {
        throw new Error(reportResult.message || "Failed to load receivables.");
      }

      setReport(reportResult.data as ReceivablesReport);

      if (customersResponse.ok) {
        const customersResult = await customersResponse.json();

        if (customersResult.success) {
          setCustomers(customersResult.data as Customer[]);
        }
      }
    } catch (error) {
      console.error("Failed to load receivables:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to load receivables.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Receivables Planning
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500">
          Plan selected-order credit collections by due month.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Month"
            value={filters.month}
            onChange={(value) => updateFilter("month", value)}
            options={months}
          />
          <NumberInput
            label="Year"
            value={filters.year}
            onChange={(value) => updateFilter("year", value)}
            placeholder="2026"
          />
          <NumberInput
            label="Receivable Threshold"
            value={filters.threshold}
            onChange={(value) => updateFilter("threshold", value)}
            placeholder="Example: 1000000"
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
              ["PENDING", "Pending"],
              ["DUE", "Due"],
              ["OVERDUE", "Overdue"],
            ]}
          />
          <FilterSelect
            label="Customer"
            value={filters.customerId}
            onChange={(value) => updateFilter("customerId", value)}
            allLabel="All Customers"
            options={customers.map((customer) => [
              customer.id,
              customer.customerName,
            ])}
          />
          <FilterSelect
            label="Created By"
            value={filters.createdByRole}
            onChange={(value) => updateFilter("createdByRole", value)}
            options={[
              ["ADMIN", "Admin"],
              ["SUPERADMIN", "Superadmin"],
            ]}
          />
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
            onClick={() => setAppliedFilters(filters)}
            className="rounded-xl bg-[#FFBF01] px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
          >
            Apply Filters
          </button>
        </div>
      </section>

      <ThresholdBanner report={report} />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Projected Receivables"
          value={formatCurrency(report?.summary.projectedReceivableAmount ?? 0)}
        />
        <SummaryCard
          label="Threshold Amount"
          value={
            report?.summary.thresholdAmount === null ||
            typeof report?.summary.thresholdAmount === "undefined"
              ? "Not set"
              : formatCurrency(report.summary.thresholdAmount)
          }
        />
        <SummaryCard
          label="Excess Amount"
          value={formatCurrency(report?.summary.excessAmount ?? 0)}
          tone={(report?.summary.excessAmount ?? 0) > 0 ? "red" : "gray"}
        />
        <SummaryCard
          label="Suggested Reduction"
          value={formatCurrency(report?.summary.suggestedReductionAmount ?? 0)}
          tone={(report?.summary.suggestedReductionAmount ?? 0) > 0 ? "amber" : "gray"}
        />
        <SummaryCard
          label="After Suggested Unselect"
          value={formatCurrency(
            report?.summary.amountAfterSuggestedUnselect ?? 0
          )}
        />
        <SummaryCard
          label="Receivable Orders"
          value={(report?.summary.totalReceivableCount ?? 0).toLocaleString(
            "en-LK"
          )}
        />
        <SummaryCard
          label="Overdue Amount"
          value={formatCurrency(report?.summary.overdueAmount ?? 0)}
          tone="red"
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Daily Receivables"
          description="Expected collections by due date in the selected month."
        >
          <SalesLineChart
            data={report?.dailyReceivables ?? []}
            xKey="date"
            lines={[
              {
                key: "totalAmount",
                name: "Expected amount",
                color: "#2563eb",
              },
            ]}
          />
        </ChartCard>

        <ChartCard title="Status Breakdown">
          <BreakdownPieChart
            data={[
              {
                name: "Upcoming",
                amount: report?.statusBreakdown.upcomingAmount ?? 0,
              },
              {
                name: "Due Today",
                amount: report?.statusBreakdown.dueTodayAmount ?? 0,
              },
              {
                name: "Overdue",
                amount: report?.statusBreakdown.overdueAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="VAT vs NON-VAT Receivables">
          <BreakdownPieChart
            data={[
              {
                name: "VAT",
                amount: report?.orderTypeBreakdown.vatAmount ?? 0,
              },
              {
                name: "NON-VAT",
                amount: report?.orderTypeBreakdown.nonVatAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Customer Receivables">
          <RankingBarChart
            data={(report?.customerReceivables ?? [])
              .slice(0, 10)
              .map((customer) => ({
                customerName: customer.customerName,
                totalAmount: customer.totalAmount,
              }))}
            xKey="customerName"
            yKey="totalAmount"
            layout="vertical"
          />
        </ChartCard>
      </section>

      <ReceivableOrdersTable
        rows={report?.receivableOrders ?? []}
        isLoading={isLoading}
      />
      <CustomerReceivablesTable
        rows={report?.customerReceivables ?? []}
        isLoading={isLoading}
      />
      <DailyReceivablesTable
        rows={report?.dailyReceivables ?? []}
        isLoading={isLoading}
      />
    </main>
  );
}

function ThresholdBanner({ report }: { report: ReceivablesReport | null }) {
  if (!report || report.thresholdAmount === null) {
    return (
      <section className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <p className="text-sm font-bold text-stone-800">
          Enter a threshold amount to check whether projected receivables exceed
          the limit.
        </p>
      </section>
    );
  }

  if (!report.summary.thresholdExceeded) {
    return (
      <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-900">
          Projected receivables are within the threshold.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-bold text-amber-950">
        Projected receivables exceed the threshold by{" "}
        {formatCurrency(report.summary.excessAmount)}. Suggested orders are
        highlighted below.
      </p>
      {!report.thresholdPlan.canFullyMeetThreshold && (
        <p className="mt-1 text-sm font-semibold text-red-800">
          The threshold cannot be fully met using unselectable orders only.
        </p>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: string;
  tone?: "amber" | "red" | "gray";
}) {
  const toneClass = {
    amber: "text-amber-800",
    red: "text-red-800",
    gray: "text-black",
  }[tone];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ReceivableOrdersTable({
  rows,
  isLoading,
}: {
  rows: ReceivablesReport["receivableOrders"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <TableHeader title="Receivable Orders" />
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading receivable orders..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No receivable orders found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Order Date</th>
                <th className="p-4 font-medium">Due Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment Status</th>
                <th className="p-4 font-medium">Collection Status</th>
                <th className="p-4 font-medium">Can Unselect</th>
                <th className="p-4 font-medium">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className={`transition-colors hover:bg-stone-50/60 ${
                    order.suggestedForUnselect ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="p-4">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-bold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {order.displayOrderId}
                    </Link>
                    <p className="mt-0.5 text-xs font-medium text-stone-500">
                      {order.orderId}
                    </p>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/customers/${order.customerId}`}
                      className="font-semibold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {order.customerName}
                    </Link>
                  </td>
                  <td className="p-4">{formatEnumLabel(order.orderType)}</td>
                  <td className="p-4 text-stone-700">
                    {formatDate(order.orderDate)}
                  </td>
                  <td className="p-4 font-semibold text-black">
                    {formatDate(order.dueDate)}
                  </td>
                  <td className="p-4 font-bold text-black">
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className="p-4">{formatEnumLabel(order.paymentStatus)}</td>
                  <td className="p-4">
                    <Badge
                      label={formatEnumLabel(order.collectionStatus)}
                      className={getStatusBadgeClass(order.collectionStatus)}
                    />
                  </td>
                  <td className="p-4">
                    {order.canUnselect ? (
                      <Badge
                        label="Can unselect"
                        className="bg-emerald-100 text-emerald-800"
                      />
                    ) : (
                      <div>
                        <Badge
                          label="Locked"
                          className="bg-stone-200 text-stone-700"
                        />
                        <p className="mt-1 text-xs font-medium text-stone-500">
                          {getLockReason(order)}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {order.suggestedForUnselect ? (
                      <Badge
                        label="Suggested to unselect"
                        className="bg-amber-100 text-amber-800"
                      />
                    ) : (
                      <span className="text-sm font-medium text-stone-500">
                        Keep
                      </span>
                    )}
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

function CustomerReceivablesTable({
  rows,
  isLoading,
}: {
  rows: ReceivablesReport["customerReceivables"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <TableHeader title="Customer Receivables" />
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading customer receivables..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No customer receivables found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Contact Person</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Total Receivable</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Nearest Due Date</th>
                <th className="p-4 font-medium">Overdue Amount</th>
                <th className="p-4 font-medium">Upcoming Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((customer) => (
                <tr key={customer.customerId} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4">
                    <Link
                      href={`/customers/${customer.customerId}`}
                      className="font-bold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {customer.customerName}
                    </Link>
                  </td>
                  <td className="p-4 text-stone-700">
                    {customer.contactPerson ?? "-"}
                  </td>
                  <td className="p-4 text-stone-700">{customer.phone ?? "-"}</td>
                  <td className="p-4 font-bold text-black">
                    {formatCurrency(customer.totalAmount)}
                  </td>
                  <td className="p-4 text-stone-700">
                    {customer.orderCount.toLocaleString("en-LK")}
                  </td>
                  <td className="p-4 text-stone-700">
                    {customer.nearestDueDate
                      ? formatDate(customer.nearestDueDate)
                      : "-"}
                  </td>
                  <td className="p-4 text-red-800">
                    {formatCurrency(customer.overdueAmount)}
                  </td>
                  <td className="p-4 text-blue-800">
                    {formatCurrency(customer.upcomingAmount)}
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

function DailyReceivablesTable({
  rows,
  isLoading,
}: {
  rows: ReceivablesReport["dailyReceivables"];
  isLoading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <TableHeader title="Daily Receivables" />
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading daily receivables..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No daily receivables found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Due Date</th>
                <th className="p-4 font-medium">Expected Amount</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Upcoming</th>
                <th className="p-4 font-medium">Due Today</th>
                <th className="p-4 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-bold text-black">
                    {formatDate(row.date)}
                  </td>
                  <td className="p-4 font-bold text-black">
                    {formatCurrency(row.totalAmount)}
                  </td>
                  <td className="p-4 text-stone-700">
                    {row.orderCount.toLocaleString("en-LK")}
                  </td>
                  <td className="p-4 text-blue-800">
                    {formatCurrency(row.upcomingAmount)}
                  </td>
                  <td className="p-4 text-amber-800">
                    {formatCurrency(row.dueTodayAmount)}
                  </td>
                  <td className="p-4 text-red-800">
                    {formatCurrency(row.overdueAmount)}
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

function TableHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
      <h2 className="text-base font-bold text-black">{title}</h2>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  if (label.startsWith("Loading")) {
    return <SkeletonTable columns={6} rows={5} />;
  }

  return (
    <div className="p-8 text-center text-sm font-medium text-stone-500">
      {label}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase text-stone-500">
        {label}
      </span>
      <input
        type="number"
        min="0"
        value={value}
        placeholder={placeholder}
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
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  allLabel?: string;
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
        <option value="">{allLabel}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
